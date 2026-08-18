import { NextResponse } from "next/server";

import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "jobs", "reopen");
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const reason = typeof (body as Record<string, unknown>)?.reason === "string"
    ? String((body as Record<string, unknown>).reason).trim()
    : "";
  if (!reason) return jsonError("Reason for Reopening is required", 400);
  if (reason.length > 2000) return jsonError("Reason for Reopening is too long", 400);

  const { jobId } = await context.params;
  const { error } = await createAdminClient().rpc("reopen_completed_job", {
    p_org_id: session.org_id,
    p_job_id: jobId,
    p_actor_id: session.user.id,
    p_reason: reason,
  });
  if (error) {
    console.error("Unable to reopen completed job", { code: error.code, message: error.message });
    const safeMessage = error.message.includes("Completed job not found")
      ? "Completed job not found"
      : error.message.includes("already been reopened")
        ? "This completion has already been reopened"
        : "Unable to reopen job";
    return jsonError(safeMessage, 409);
  }
  return NextResponse.json({ job: { id: jobId, job_status: "work_in_process" } });
}
