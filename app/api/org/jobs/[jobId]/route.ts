import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { getJobDetail } from "@/lib/jobs/data";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/jobs/[jobId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "jobs", "view");
  if (denied) return denied;

  const { jobId } = await context.params;
  const admin = createAdminClient();
  const result = await getJobDetail(admin, session.org_id, jobId);
  if (result.error) return jsonError("Unable to fetch job", 500);
  if (!result.job) return jsonError("Job not found", 404);
  const [canReopen, canEditCompletion] = await Promise.all([
    hasOrgPermission(session, "jobs", "reopen"),
    hasOrgPermission(session, "jobs", "update_status"),
  ]);
  return NextResponse.json({
    job: result.job,
    permissions: {
      can_reopen: canReopen,
      can_edit_completion: canEditCompletion,
    },
  });
}
