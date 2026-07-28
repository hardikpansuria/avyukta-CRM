import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  uploadPurchaseOrderDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/job-purchase-orders/[poId]/documents">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const { poId } = await context.params;
  const admin = createAdminClient();
  const { data: purchaseOrder, error: ownershipError } = await admin
    .from("job_purchase_orders")
    .select("id")
    .eq("id", poId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (ownershipError) return jsonError("Unable to validate purchase order", 500);
  if (!purchaseOrder) return jsonError("Purchase order not found", 404);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }
  const entry = formData.get("file");
  const documentType =
    formData.get("document_type") === "purchase_order"
      ? "purchase_order"
      : "supporting_document";
  if (!(entry instanceof File) || entry.size === 0) {
    return jsonError("Select a document to upload", 400);
  }
  const validationError = validateDocument(entry, {
    pdfOnly: documentType === "purchase_order",
  });
  if (validationError) return jsonError(validationError, 400);

  const result = await uploadPurchaseOrderDocument({
    admin,
    orgId: session.org_id,
    purchaseOrderId: poId,
    actorId: session.user.id,
    file: entry,
    documentType,
  });
  if (result.error) return jsonError("Unable to upload document", 500);
  return NextResponse.json({ document: result.document }, { status: 201 });
}

