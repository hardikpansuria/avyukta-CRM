import { NextResponse } from "next/server";

import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

const bucket = "work-completion-acknowledgements";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string; completionId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "jobs", "view");
  if (denied) return denied;
  const { jobId, completionId } = await context.params;
  const admin = createAdminClient();
  const { data: completion, error } = await admin.from("job_work_completions")
    .select("certificate_file_name,certificate_storage_path,generation_status")
    .eq("id", completionId).eq("job_id", jobId).eq("org_id", session.org_id).maybeSingle();
  if (error) return jsonError("Unable to validate certificate", 500);
  if (!completion || completion.generation_status !== "generated" || !completion.certificate_storage_path) {
    return jsonError("Completion certificate not found", 404);
  }
  const expectedPrefix = `${session.org_id}/jobs/${jobId}/work-completions/`;
  if (!completion.certificate_storage_path.startsWith(expectedPrefix)) return jsonError("Certificate path is invalid", 409);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error: signedError } = await admin.storage.from(bucket).createSignedUrl(
    completion.certificate_storage_path,
    5 * 60,
    { download: download ? completion.certificate_file_name || "work-completion.pdf" : false },
  );
  if (signedError || !data?.signedUrl) return jsonError("Unable to create certificate link", 500);
  return NextResponse.json({ signed_url: data.signedUrl, expires_in: 300, file_name: completion.certificate_file_name });
}
