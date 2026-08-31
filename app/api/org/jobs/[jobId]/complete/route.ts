import { NextResponse } from "next/server";

import { requireOrgPermission } from "@/lib/auth/permissions";
import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { workCompletionDraftErrorMessage } from "@/lib/jobs/runtime-errors";
import { getWorkCompletionPdfData } from "@/lib/jobs/work-completion";
import { renderWorkCompletionPdf } from "@/lib/jobs/work-completion-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const bucket = "work-completion-acknowledgements";
const maxPdfBytes = 15 * 1024 * 1024;

function jsonError(error: string, status: number, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

function uniqueIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === "string" && /^[0-9a-f-]{36}$/i.test(item))));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  const denied = await requireOrgPermission(session, "jobs", "update_status");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400, "INVALID_REQUEST");
  }
  const unexpected = Object.keys(body).filter((key) => ![
    "completion_date", "technician_ids", "completion_notes", "outstanding_items", "completion_status",
  ].includes(key));
  if (unexpected.length) return jsonError("The request contains unsupported fields", 400, "INVALID_REQUEST");

  const completionDate = optionalText(body.completion_date);
  const technicianIds = uniqueIds(body.technician_ids);
  const completionStatus = optionalText(body.completion_status);
  const completionNotes = optionalText(body.completion_notes);
  const outstandingItems = optionalText(body.outstanding_items);
  if (!completionDate || !/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
    return jsonError("Completion Date is required", 400, "INVALID_COMPLETION_DATE");
  }
  const parsedDate = new Date(`${completionDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== completionDate) {
    return jsonError("Completion Date is invalid", 400, "INVALID_COMPLETION_DATE");
  }
  if (completionDate > new Date().toISOString().slice(0, 10)) {
    return jsonError("Completion Date cannot be in the future", 400, "INVALID_COMPLETION_DATE");
  }
  if (!technicianIds.length) return jsonError("Select at least one Technician", 400, "TECHNICIAN_REQUIRED");
  if (!completionStatus || !["completed", "completed_with_outstanding_items"].includes(completionStatus)) {
    return jsonError("Select a valid Completion Status", 400, "INVALID_COMPLETION_STATUS");
  }
  if (completionStatus === "completed_with_outstanding_items" && !outstandingItems) {
    return jsonError("Outstanding Items are required for this completion status", 400, "OUTSTANDING_ITEMS_REQUIRED");
  }

  const { jobId } = await context.params;
  const admin = createAdminClient();
  const { data: jobOwner, error: ownerError } = await admin
    .from("jobs")
    .select("salesperson_id")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (ownerError) return jsonError("Unable to validate job ownership", 500, "JOB_LOOKUP_FAILED");
  if (!jobOwner) return jsonError("Job not found", 404, "JOB_NOT_FOUND");
  const scopeDenied = await requireOwnedMutation(session, "jobs", [jobOwner.salesperson_id]);
  if (scopeDenied) return scopeDenied;
  const { data: draftValue, error: draftError } = await admin.rpc("create_job_work_completion_draft", {
    p_org_id: session.org_id,
    p_job_id: jobId,
    p_actor_id: session.user.id,
    p_completion_date: completionDate,
    p_completion_status: completionStatus,
    p_completion_notes: completionNotes,
    p_outstanding_items: outstandingItems,
    p_employee_ids: technicianIds,
  });
  if (draftError) {
    console.error("Unable to create work completion draft", { code: draftError.code, message: draftError.message });
    return jsonError(workCompletionDraftErrorMessage(draftError.message), 409, "COMPLETION_REJECTED");
  }
  const draft = draftValue as { id?: string; certificate_number?: string; revision_number?: number } | null;
  if (!draft?.id || !draft.certificate_number) return jsonError("Unable to reserve a completion certificate", 500, "CERTIFICATE_RESERVATION_FAILED");

  const markFailed = async () => {
    await admin.from("job_work_completions").update({ generation_status: "failed" }).eq("id", draft.id).eq("org_id", session.org_id).eq("generation_status", "generating");
  };
  const pdfResult = await getWorkCompletionPdfData(admin, session.org_id, jobId, draft.id);
  if (pdfResult.error || !pdfResult.data) {
    await markFailed();
    return jsonError("Unable to collect acknowledgement information", 500, "CERTIFICATE_DATA_FAILED");
  }

  let pdf: Buffer;
  try {
    pdf = await renderWorkCompletionPdf(pdfResult.data);
  } catch (error) {
    console.error("Unable to render Work Completion Acknowledgement", { completionId: draft.id, error });
    await markFailed();
    return jsonError("Unable to generate the Work Completion Acknowledgement", 500, "CERTIFICATE_RENDER_FAILED");
  }
  if (!pdf.length || pdf.length > maxPdfBytes) {
    await markFailed();
    return jsonError("Generated acknowledgement has an invalid size", 500, "CERTIFICATE_SIZE_INVALID");
  }

  const fileName = `${draft.certificate_number}${Number(draft.revision_number ?? 1) > 1 ? `-revision-${draft.revision_number}` : ""}.pdf`;
  const filePath = `${session.org_id}/jobs/${jobId}/work-completions/${draft.id}.pdf`;
  const { error: uploadError } = await admin.storage.from(bucket).upload(filePath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    await markFailed();
    return jsonError("Unable to store the Work Completion Acknowledgement", 500, "CERTIFICATE_UPLOAD_FAILED");
  }

  const generatedAt = new Date().toISOString();
  const { error: finalizeError } = await admin.rpc("finalize_job_work_completion", {
    p_org_id: session.org_id,
    p_job_id: jobId,
    p_completion_id: draft.id,
    p_actor_id: session.user.id,
    p_file_name: fileName,
    p_storage_path: filePath,
    p_file_size: pdf.length,
    p_generated_at: generatedAt,
  });
  if (finalizeError) {
    await admin.storage.from(bucket).remove([filePath]);
    await markFailed();
    return jsonError("The job changed before completion could be finalized", 409, "COMPLETION_CONFLICT");
  }

  const { data: signed } = await admin.storage.from(bucket).createSignedUrl(filePath, 5 * 60);
  return NextResponse.json({
    job: { id: jobId, job_status: "work_completed" },
    completion: {
      id: draft.id,
      certificate_number: draft.certificate_number,
      revision_number: draft.revision_number ?? 1,
      completion_date: completionDate,
      certificate_generated_at: generatedAt,
      signed_url: signed?.signedUrl ?? null,
    },
  });
}
