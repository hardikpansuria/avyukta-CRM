import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrgScopedStoragePath } from "@/lib/supabase/storage-path";

const bucketName = "customer-quotation-pdfs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation/generated-documents/[documentId]">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "quotations", "view");
  if (denied) return denied;

  const { id, documentId } = await context.params;
  const admin = createAdminClient();
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (quotationError) return jsonError("Unable to validate quotation", 500);
  if (!quotation) return jsonError("Quotation not found", 404);

  const { data: document, error: documentError } = await admin
    .from("quotation_generated_documents")
    .select("*")
    .eq("id", documentId)
    .eq("org_id", session.org_id)
    .eq("quotation_id", id)
    .maybeSingle();

  if (documentError) return jsonError("Unable to fetch document", 500);
  if (!document) return jsonError("Generated document not found", 404);

  const expectedPath = `${session.org_id}/quotations/${id}/customer-quotations/revision-${document.revision_number}/${documentId}.pdf`;
  if (
    document.file_path !== expectedPath ||
    !isOrgScopedStoragePath(expectedPath, session.org_id)
  ) {
    return jsonError("Generated document path is invalid", 409);
  }

  const { data: signedData, error: signedError } = await admin.storage
    .from(bucketName)
    .createSignedUrl(expectedPath, 10 * 60);

  if (signedError || !signedData?.signedUrl) {
    return jsonError("Unable to open generated document", 500);
  }

  return NextResponse.json({
    document: {
      ...document,
      signed_url: signedData.signedUrl,
    },
  });
}
