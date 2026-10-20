import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { isDuplicatePurchaseOrderNumberError } from "@/lib/jobs/runtime-errors";
import { getPurchaseOrder } from "@/lib/jobs/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const body = (await request.json().catch(() => null)) as
    | { po_number?: unknown }
    | null;
  const poNumber =
    typeof body?.po_number === "string" ? body.po_number.trim() : "";
  if (!poNumber) return jsonError("PO number is required", 400);

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

  if (purchaseOrder.po_number === poNumber) {
    const result = await getPurchaseOrder(admin, session.org_id, poId);
    if (result.error || !result.purchaseOrder) {
      return jsonError("Unable to fetch purchase order", 500);
    }
    return NextResponse.json({ purchase_order: result.purchaseOrder });
  }

  const { data: updatedPurchaseOrder, error: updateError } = await admin
    .from("job_purchase_orders")
    .update({
      po_number: poNumber,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", poId)
    .eq("org_id", session.org_id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    if (isDuplicatePurchaseOrderNumberError(updateError)) {
      return jsonError(
        "This customer already has a purchase order with that PO number",
        409,
      );
    }
    console.error("Unable to update purchase order number", updateError);
    return jsonError("Unable to update purchase order number", 500);
  }
  if (!updatedPurchaseOrder) {
    return jsonError("Purchase order changed while this request was processed", 409);
  }

  const result = await getPurchaseOrder(admin, session.org_id, poId);
  if (result.error || !result.purchaseOrder) {
    return jsonError("Purchase order was updated but could not be reloaded", 500);
  }

  return NextResponse.json({ purchase_order: result.purchaseOrder });
}
