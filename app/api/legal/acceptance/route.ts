import { NextResponse } from "next/server";

import { verifyOrgSessionWithoutLegalGate } from "@/lib/auth/verify-org-session";
import { getMissingRequiredLegalDocuments } from "@/lib/legal/acceptance";
import { sendAcceptanceReceiptEmail } from "@/lib/legal/acceptance-receipt-email";
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

  const [
    { data: profile, error: profileError },
    { data: evidence, error: evidenceError },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.user.id)
      .maybeSingle(),
    admin
      .from("legal_acceptances")
      .select(
        "document_key, document_version, content_hash, action_type, accepted_at",
      )
      .eq("user_id", session.user.id)
      .eq("organization_id", session.org_id)
      .in(
        "document_key",
        missing.map((document) => document.key),
      ),
  ]);

  let receiptEmailStatus: "sent" | "skipped" | "failed" = "skipped";

  if (profileError || evidenceError) {
    console.error("Unable to prepare legal acceptance receipt email", {
      profileError,
      evidenceError,
    });
  } else {
    const recipientEmail = profile?.email ?? session.user.email;
    const acceptedDocuments = missing.flatMap((document) => {
      const record = (evidence ?? []).find(
        (candidate) =>
          candidate.document_key === document.key &&
          candidate.document_version === document.version &&
          candidate.content_hash === document.contentHash &&
          candidate.action_type === document.actionType,
      );

      if (!record) return [];

      return [
        {
          key: document.key,
          title: document.title,
          version: document.version,
          contentHash: document.contentHash,
          actionType: document.actionType,
          acceptedAt: record.accepted_at,
        },
      ];
    });

    if (recipientEmail && acceptedDocuments.length === missing.length) {
      const result = await sendAcceptanceReceiptEmail({
        userId: session.user.id,
        organizationId: session.org_id,
        recipientEmail,
        recipientName:
          profile?.full_name ??
          (typeof session.user.user_metadata.full_name === "string"
            ? session.user.user_metadata.full_name
            : null),
        organizationName: session.org_name,
        organizationCode: session.org_code,
        acceptanceSource,
        documents: acceptedDocuments,
        privacyContactEmail: configuration.privacyContactEmail,
      });
      receiptEmailStatus = result.status;
    } else {
      console.error(
        "Legal acceptance was recorded, but receipt evidence could not be resolved.",
      );
    }
  }

  return NextResponse.json({
    success: true,
    receipt_email: receiptEmailStatus,
  });
}
