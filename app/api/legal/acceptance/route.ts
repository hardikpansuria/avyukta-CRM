import { NextResponse } from "next/server";

import { verifyOrgSessionWithoutLegalGate } from "@/lib/auth/verify-org-session";
import { getMissingRequiredLegalDocuments } from "@/lib/legal/acceptance";
import { getLegalSiteConfiguration } from "@/lib/legal/config";
import { createAdminClient } from "@/lib/supabase/admin";

type AcceptanceBody = {
  confirmed?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  let body: AcceptanceBody;

  try {
    body = (await request.json()) as AcceptanceBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  if (body.confirmed !== true) {
    return jsonError("Confirmation is required", 400);
  }

  const configuration = getLegalSiteConfiguration();

  if (!configuration.ready) {
    return jsonError("Legal configuration is not approved", 503);
  }

  const session = await verifyOrgSessionWithoutLegalGate();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const missing = await getMissingRequiredLegalDocuments(
    session.user.id,
    session.org_id,
  );

  if (missing.length === 0) {
    return NextResponse.json({ success: true });
  }

  const admin = createAdminClient();
  const { count, error: historyError } = await admin
    .from("legal_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .eq("organization_id", session.org_id);

  if (historyError) {
    return jsonError("Unable to validate prior legal history", 500);
  }

  const acceptanceSource = (count ?? 0) > 0
    ? "version_update"
    : "first_login_gate";
  const { error } = await admin.from("legal_acceptances").upsert(
    missing.map((document) => ({
      user_id: session.user.id,
      organization_id: session.org_id,
      document_key: document.key,
      document_version: document.version,
      content_hash: document.contentHash,
      action_type: document.actionType,
      acceptance_source: acceptanceSource,
    })),
    {
      onConflict:
        "user_id,organization_id,document_key,document_version",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    return jsonError("Unable to record legal agreement", 500);
  }

  const stillMissing = await getMissingRequiredLegalDocuments(
    session.user.id,
    session.org_id,
  );

  if (stillMissing.length > 0) {
    return jsonError(
      "A legal document changed without a version increase. Update its configured version before collecting a new agreement.",
      409,
    );
  }

  return NextResponse.json({ success: true });
}
