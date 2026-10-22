import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { isDuplicatePurchaseOrderNumberError } from "@/lib/jobs/runtime-errors";
import {
  removePurchaseOrderDocument,
  uploadPurchaseOrderDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { getPurchaseOrder } from "@/lib/jobs/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/job-purchase-orders/[poId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "view");
  if (denied) return denied;
  const { poId } = await context.params;
  const admin = createAdminClient();
  const result = await getPurchaseOrder(
    admin,
    session.org_id,
    poId,
  );
  if (result.error) return jsonError("Unable to fetch purchase order", 500);
  if (!result.purchaseOrder) return jsonError("Purchase order not found", 404);

  const { data: auditRows, error: auditError } = await admin
    .from("customer_activities")
    .select("id,description,actor_id,occurred_at,metadata")
    .eq("org_id", session.org_id)
    .eq("customer_id", result.purchaseOrder.customer_id)
    .eq("activity_type", "customer_po_updated")
    .eq("linked_record_type", "purchase_order")
    .eq("linked_record_id", poId)
    .order("occurred_at", { ascending: false });
  if (auditError) return jsonError("Unable to fetch purchase order history", 500);

  const actorIds = Array.from(
    new Set(
      (auditRows ?? [])
        .map((row) => row.actor_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const { data: actors, error: actorsError } = actorIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", actorIds)
    : { data: [], error: null };
  if (actorsError) return jsonError("Unable to fetch purchase order history", 500);
  const actorsById = new Map((actors ?? []).map((actor) => [actor.id, actor]));

  const canEditPermission = await hasOrgPermission(
    session,
    "purchase_orders",
    "edit",
  );
  let canEdit = canEditPermission;

  if (canEditPermission && (session.role === "sales" || session.role === "salesperson")) {
    const jobIds = Array.from(
      new Set(
        result.purchaseOrder.allocations
          .map((allocation) => allocation.job_id)
          .filter(Boolean),
      ),
    );
    const { data: jobs, error: jobsError } = jobIds.length
      ? await admin
          .from("jobs")
          .select("salesperson_id")
          .eq("org_id", session.org_id)
          .in("id", jobIds)
      : { data: [], error: null };
    if (jobsError) return jsonError("Unable to validate purchase order access", 500);

    const scopeDenied = await requireOwnedMutation(
      session,
      "purchase_orders",
      (jobs ?? []).map((job) => job.salesperson_id),
      "all",
    );
    canEdit = !scopeDenied;
  }

  return NextResponse.json({
    purchase_order: result.purchaseOrder,
    permissions: { can_edit: canEdit },
    audit_history: (auditRows ?? []).map((row) => ({
      ...row,
      actor: row.actor_id ? actorsById.get(row.actor_id as string) ?? null : null,
    })),
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/job-purchase-orders/[poId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "edit");
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const poNumber = String(formData.get("po_number") ?? "").trim();
  if (!poNumber) return jsonError("PO number is required", 400);
  if (poNumber.length > 120) {
    return jsonError("PO number must be 120 characters or less", 400);
  }

  const amountValue = String(formData.get("po_amount_before_tax") ?? "").trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(amountValue)) {
    return jsonError(
      "PO Amount Before Tax is required and must use no more than two decimal places",
      400,
    );
  }
  const poAmountBeforeTax = Number(amountValue);
  if (!Number.isFinite(poAmountBeforeTax) || poAmountBeforeTax < 0) {
    return jsonError("PO Amount Before Tax cannot be negative", 400);
  }

  const internalRemarks = String(formData.get("internal_remarks") ?? "").trim();
  if (!internalRemarks) return jsonError("Internal Remarks are required", 400);
  if (internalRemarks.length > 4000) {
    return jsonError("Internal Remarks must be 4,000 characters or less", 400);
  }

  const receivedDateValue = String(formData.get("po_received_date") ?? "").trim();
  const receivedDate = receivedDateValue || null;
  if (receivedDate) {
    const parsedDate = new Date(`${receivedDate}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(receivedDate) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== receivedDate
    ) {
      return jsonError("Purchase Order Received Date is invalid", 400);
    }
  }

  const documentEntry = formData.get("document");
  const document =
    documentEntry instanceof File && documentEntry.size > 0
      ? documentEntry
      : null;
  if (document) {
    const documentError = validateDocument(document, { poRevision: true });
    if (documentError) return jsonError(documentError, 400);
  }

  const { poId } = await context.params;
  const admin = createAdminClient();
  const [{ data: purchaseOrder, error: poError }, { data: allocations, error: allocationsError }] =
    await Promise.all([
      admin
        .from("job_purchase_orders")
        .select("id,po_number")
        .eq("id", poId)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      admin
        .from("job_purchase_order_allocations")
        .select("job_id")
        .eq("purchase_order_id", poId)
        .eq("org_id", session.org_id),
    ]);

  if (poError || allocationsError) {
    return jsonError("Unable to validate purchase order", 500);
  }
  if (!purchaseOrder) return jsonError("Purchase order not found", 404);

  const jobIds = Array.from(
    new Set((allocations ?? []).map((allocation) => allocation.job_id)),
  );
  const { data: jobs, error: jobsError } = jobIds.length
    ? await admin
        .from("jobs")
        .select("salesperson_id")
        .eq("org_id", session.org_id)
        .in("id", jobIds)
    : { data: [], error: null };
  if (jobsError) return jsonError("Unable to validate purchase order access", 500);

  const scopeDenied = await requireOwnedMutation(
    session,
    "purchase_orders",
    (jobs ?? []).map((job) => job.salesperson_id),
    "all",
  );
  if (scopeDenied) return scopeDenied;

  let uploadedDocument:
    | { id: string; file_path: string }
    | null = null;
  if (document) {
    const uploadResult = await uploadPurchaseOrderDocument({
      admin,
      orgId: session.org_id,
      purchaseOrderId: poId,
      actorId: session.user.id,
      file: document,
      documentType: "po_revision",
    });
    if (uploadResult.error || !uploadResult.document) {
      return jsonError("Unable to upload the replacement PO document", 500);
    }
    uploadedDocument = uploadResult.document as {
      id: string;
      file_path: string;
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error: updateError } = await supabase.rpc(
    "update_job_purchase_order_details",
    {
      p_purchase_order_id: poId,
      p_po_number: poNumber,
      p_po_amount_before_tax: poAmountBeforeTax,
      p_internal_remarks: internalRemarks,
      p_po_received_date: receivedDate,
      p_document_id: uploadedDocument?.id ?? null,
    },
  );

  if (updateError) {
    if (uploadedDocument) {
      const cleanupResult = await removePurchaseOrderDocument({
        admin,
        orgId: session.org_id,
        purchaseOrderId: poId,
        document: uploadedDocument,
      });
      if (cleanupResult.error) {
        console.error("Unable to clean up rejected PO document upload", {
          purchaseOrderId: poId,
          documentId: uploadedDocument.id,
          error: cleanupResult.error,
        });
      }
    }
    if (isDuplicatePurchaseOrderNumberError(updateError)) {
      return jsonError(
        "This customer already has a purchase order with that PO number",
        409,
      );
    }
    if (updateError.code === "P0001" || updateError.code === "23514") {
      return jsonError(updateError.message, 409);
    }
    console.error("Unable to update purchase order details", updateError);
    return jsonError("Unable to update purchase order details", 500);
  }

  const result = await getPurchaseOrder(admin, session.org_id, poId);
  if (result.error || !result.purchaseOrder) {
    return jsonError("Purchase order was updated but could not be reloaded", 500);
  }

  return NextResponse.json({
    purchase_order: result.purchaseOrder,
    message: "Purchase order details updated successfully",
  });
}
