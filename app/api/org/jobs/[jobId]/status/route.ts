import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = new Set(["work_in_process"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/jobs/[jobId]/status">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "jobs", "update_status");
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const status =
    typeof (body as Record<string, unknown>).status === "string"
      ? String((body as Record<string, unknown>).status)
      : "";
  if (status === "work_completed") {
    return jsonError("Use Complete Job to provide the required completion information and generate the certificate", 409);
  }
  if (!allowedStatuses.has(status)) return jsonError("Invalid job status", 400);

  const { jobId } = await context.params;
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_status")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError) return jsonError("Unable to validate job", 500);
  if (!job) return jsonError("Job not found", 404);
  if (job.job_status === "po_pending") {
    return jsonError("A PO Pending job cannot enter production", 409);
  }
  if (job.job_status === "work_completed") {
    return jsonError("Only an authorized Manager or Admin can reopen a completed job", 403);
  }
  if (job.job_status === status) return NextResponse.json({ job });

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({ job_status: status, updated_by: session.user.id })
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .select("id,job_number,job_status,updated_at")
    .single();
  if (updateError || !updated) {
    return jsonError("Unable to update job status", 500);
  }
  return NextResponse.json({ job: updated });
}
