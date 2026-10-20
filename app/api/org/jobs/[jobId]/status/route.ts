import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedStatuses = new Set([
  "work_in_process",
  "on_hold",
  "cancelled",
  "terminated",
]);

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
  const reason =
    typeof (body as Record<string, unknown>).reason === "string"
      ? String((body as Record<string, unknown>).reason).trim()
      : "";
  if (status === "work_completed") {
    return jsonError("Use Complete Job to provide the required completion information and generate the certificate", 409);
  }
  if (!allowedStatuses.has(status)) return jsonError("Invalid job status", 400);
  if (["on_hold", "cancelled", "terminated"].includes(status) && !reason) {
    return jsonError("A reason is required for this job status", 400);
  }

  const { jobId } = await context.params;
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_status,salesperson_id")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError) return jsonError("Unable to validate job", 500);
  if (!job) return jsonError("Job not found", 404);
  const scopeDenied = await requireOwnedMutation(session, "jobs", [job.salesperson_id]);
  if (scopeDenied) return scopeDenied;
  if (job.job_status === "po_pending") {
    return jsonError("A PO Pending job cannot enter production", 409);
  }
  if (job.job_status === "work_completed") {
    return jsonError("Completed work cannot be put on hold, cancelled, or terminated", 409);
  }
  if (["cancelled", "terminated"].includes(job.job_status)) {
    return jsonError("Cancelled or terminated jobs cannot be changed", 409);
  }
  if (status === "work_in_process" && job.job_status !== "on_hold") {
    return jsonError("Only an On Hold job can be resumed", 409);
  }
  if (["cancelled", "terminated"].includes(status)) {
    const { data: openRequests, error: requestError } = await admin
      .from("invoice_requests")
      .select("id")
      .eq("org_id", session.org_id)
      .eq("job_id", jobId)
      .in("status", ["pending", "under_review"])
      .limit(1);
    if (requestError) return jsonError("Unable to validate open invoice requests", 500);
    if (openRequests?.length) {
      return jsonError(
        "Resolve the open invoice request before cancelling or terminating this job",
        409,
      );
    }
  }
  if (job.job_status === status) return NextResponse.json({ job });

  const { data: updated, error: updateError } = await admin
    .from("jobs")
    .update({
      job_status: status,
      status_reason: reason || null,
      updated_by: session.user.id,
    })
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .select("id,job_number,job_status,updated_at")
    .single();
  if (updateError || !updated) {
    return jsonError("Unable to update job status", 500);
  }
  return NextResponse.json({ job: updated });
}
