import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  isExpectedPurchaseOrderDocumentPath,
  jobDocumentBuckets,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  request: Request,
  context: RouteContext<
    "/api/org/job-purchase-orders/[poId]/documents/[documentId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const { poId, documentId } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin
    .from("job_purchase_order_documents")
    .select("id,purchase_order_id,file_name,file_path,mime_type")
    .eq("id", documentId)
    .eq("purchase_order_id", poId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (error) return jsonError("Unable to validate document", 500);
  if (!document) return jsonError("Document not found", 404);
  if (
    !isExpectedPurchaseOrderDocumentPath({
      path: document.file_path,
      orgId: session.org_id,
      purchaseOrderId: poId,
      documentId,
    })
  ) {
    return jsonError("Document path is invalid", 409);
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error: signedError } = await admin.storage
    .from(jobDocumentBuckets.purchaseOrders)
    .createSignedUrl(document.file_path, 5 * 60, {
      download: download ? document.file_name : false,
    });
  if (signedError || !data?.signedUrl) {
    return jsonError("Unable to create document link", 500);
  }
  return NextResponse.json({
    signed_url: data.signedUrl,
    expires_in: 300,
    file_name: document.file_name,
  });
}
