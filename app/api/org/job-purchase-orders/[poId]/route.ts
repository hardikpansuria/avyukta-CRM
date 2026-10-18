import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { getPurchaseOrder } from "@/lib/jobs/purchase-orders";
import { isDuplicatePurchaseOrderNumberError } from "@/lib/jobs/runtime-errors";
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
  const result = await getPurchaseOrder(
    createAdminClient(),
    session.org_id,
    poId,
  );
  if (result.error) return jsonError("Unable to fetch purchase order", 500);
  if (!result.purchaseOrder) return jsonError("Purchase order not found", 404);
  const [canEdit, canRemove] = await Promise.all([
    hasOrgPermission(session, "purchase_orders", "edit"),
    hasOrgPermission(session, "purchase_orders", "delete"),
  ]);
  return NextResponse.json({
    purchase_order: result.purchaseOrder,
    permissions: { can_edit: canEdit, can_remove: canRemove },
  });
}

type AllocationInput = {
  allocation_id?: unknown;
  po_amount_before_tax?: unknown;
  difference_acknowledged?: unknown;
};

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/job-purchase-orders/[poId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "edit");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const poNumber = typeof body.po_number === "string" ? body.po_number.trim() : "";
  const poReceivedDate = typeof body.po_received_date === "string"
    ? body.po_received_date.trim()
    : "";
  const internalRemarks = typeof body.internal_remarks === "string"
    ? body.internal_remarks.trim() || null
    : null;
  if (!poNumber) return jsonError("Purchase Order Number is required", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(poReceivedDate)) {
    return jsonError("Purchase Order Received Date is required", 400);
  }
  if (!Array.isArray(body.allocations) || body.allocations.length === 0) {
    return jsonError("At least one active Purchase Order allocation is required", 400);
  }

  const allocations = (body.allocations as AllocationInput[]).map((allocation) => ({
    allocation_id:
      typeof allocation.allocation_id === "string"
        ? allocation.allocation_id.trim()
        : "",
    po_amount_before_tax: Number(allocation.po_amount_before_tax),
    difference_acknowledged: allocation.difference_acknowledged === true,
  }));
  if (allocations.some((allocation) =>
    !allocation.allocation_id ||
    !Number.isFinite(allocation.po_amount_before_tax) ||
    allocation.po_amount_before_tax < 0
  )) {
    return jsonError("Each allocation requires a valid non-negative amount", 400);
  }

  const { poId } = await context.params;
  const admin = createAdminClient();
  const { data: allocationRows, error: allocationError } = await admin
    .from("job_purchase_order_allocations")
    .select("id,job_id,jobs!inner(salesperson_id)")
    .eq("org_id", session.org_id)
    .eq("purchase_order_id", poId)
    .eq("is_active", true);
  if (allocationError) return jsonError("Unable to validate purchase order", 500);
  if (!allocationRows?.length) return jsonError("Active purchase order not found", 404);
  const scopeDenied = await requireOwnedMutation(
    session,
    "purchase_orders",
    allocationRows.map((row) => {
      const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
      return job?.salesperson_id as string | null | undefined;
    }),
    "all",
  );
  if (scopeDenied) return scopeDenied;

  const authenticated = await createSupabaseServerClient();
  const { error: rpcError } = await authenticated.rpc("update_job_purchase_order", {
    p_purchase_order_id: poId,
    p_po_number: poNumber,
    p_po_received_date: poReceivedDate,
    p_internal_remarks: internalRemarks,
    p_allocations: allocations,
  });
  if (rpcError) {
    if (isDuplicatePurchaseOrderNumberError(rpcError)) {
      return jsonError(`PO No: ${poNumber} already exists for this customer.`, 409);
    }
    return jsonError(rpcError.message || "Unable to update purchase order", 409);
  }

  const result = await getPurchaseOrder(admin, session.org_id, poId);
  if (result.error || !result.purchaseOrder) {
    return jsonError("Purchase order was saved but could not be reloaded", 500);
  }
  return NextResponse.json({ purchase_order: result.purchaseOrder });
}
