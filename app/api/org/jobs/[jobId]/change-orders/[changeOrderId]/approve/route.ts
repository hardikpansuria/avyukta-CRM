import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  uploadPurchaseOrderDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function value(form: FormData, key: string) {
  const entry = form.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string; changeOrderId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const changeOrderDenied = await requireOrgPermission(session, "change_orders", "approve");
  if (changeOrderDenied) return changeOrderDenied;
  const poDenied = await requireOrgPermission(session, "purchase_orders", "attach_po");
  if (poDenied) return poDenied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }
  const poNumber = value(form, "po_number");
  const poReceivedDate = value(form, "po_received_date");
  const amountBeforeTax = Number(value(form, "po_amount_before_tax"));
  const replacedAllocationId = value(form, "replaced_allocation_id") || null;
  const remarks = value(form, "internal_remarks") || null;
  const documentEntry = form.get("po_document");
  const document = documentEntry instanceof File && documentEntry.size ? documentEntry : null;
  if (!poNumber) return jsonError("Purchase Order Number is required", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(poReceivedDate)) return jsonError("Purchase Order Received Date is required", 400);
  if (!Number.isFinite(amountBeforeTax) || amountBeforeTax < 0) return jsonError("PO Amount Before Tax must be zero or greater", 400);
  if (!document) return jsonError("A Purchase Order document is required", 400);
  const documentError = validateDocument(document, { pdfOnly: true });
  if (documentError) return jsonError(documentError, 400);

  const { jobId, changeOrderId } = await context.params;
  const admin = createAdminClient();
  const { data: changeOrder, error: lookupError } = await admin
    .from("job_change_orders")
    .select("id,status,po_strategy,job_id,jobs!inner(customer_id,salesperson_id)")
    .eq("id", changeOrderId)
    .eq("job_id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (lookupError) return jsonError("Unable to validate Change Order", 500);
  if (!changeOrder) return jsonError("Change Order not found", 404);
  if (changeOrder.status !== "draft") return jsonError("Only a draft Change Order can be approved", 409);
  const job = changeOrder.jobs as unknown as { customer_id: string; salesperson_id?: string | null };
  const scopeDenied = await requireOwnedMutation(session, "jobs", [job.salesperson_id ?? null]);
  if (scopeDenied) return scopeDenied;
  if (changeOrder.po_strategy === "replacement" && !replacedAllocationId) {
    return jsonError("Select the active PO being replaced", 400);
  }

  const { data: duplicate, error: duplicateError } = await admin
    .from("job_purchase_orders")
    .select("id")
    .eq("org_id", session.org_id)
    .eq("customer_id", job.customer_id)
    .eq("po_number", poNumber)
    .maybeSingle();
  if (duplicateError) return jsonError("Unable to validate PO number", 500);
  if (duplicate) return jsonError(`PO No: ${poNumber} already exists for this customer.`, 409);

  const poId = crypto.randomUUID();
  const { error: poError } = await admin.from("job_purchase_orders").insert({
    id: poId,
    org_id: session.org_id,
    customer_id: job.customer_id,
    po_number: poNumber,
    po_received_date: poReceivedDate,
    internal_remarks: remarks,
    created_by: session.user.id,
    updated_by: session.user.id,
  });
  if (poError) return jsonError(poError.message, 409);

  const upload = await uploadPurchaseOrderDocument({
    admin,
    orgId: session.org_id,
    purchaseOrderId: poId,
    actorId: session.user.id,
    file: document,
    documentType: "purchase_order",
  });
  if (upload.error || !upload.document) {
    await admin.from("job_purchase_orders").delete().eq("id", poId).eq("org_id", session.org_id);
    return jsonError(upload.error ?? "Unable to upload PO document", 500);
  }

  const client = await createSupabaseServerClient();
  const { data: allocationId, error: approveError } = await client.rpc("approve_job_change_order", {
    p_change_order_id: changeOrderId,
    p_purchase_order_id: poId,
    p_po_amount_before_tax: amountBeforeTax,
    p_replaced_allocation_id: replacedAllocationId,
  });
  if (approveError || !allocationId) {
    await admin.storage.from("job-purchase-order-documents").remove([upload.document.file_path]);
    await admin.from("job_purchase_order_documents").delete().eq("id", upload.document.id).eq("org_id", session.org_id);
    await admin.from("job_purchase_orders").delete().eq("id", poId).eq("org_id", session.org_id);
    return jsonError(approveError?.message ?? "Unable to approve Change Order", 409);
  }
  return NextResponse.json({ purchase_order_id: poId, allocation_id: allocationId });
}
