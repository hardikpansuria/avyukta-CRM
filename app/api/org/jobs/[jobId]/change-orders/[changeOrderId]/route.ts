import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ jobId: string; changeOrderId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "change_orders", "edit");
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const { jobId, changeOrderId } = await context.params;
  const admin = createAdminClient();
  const { data: changeOrder, error } = await admin
    .from("job_change_orders")
    .select("*,jobs!inner(salesperson_id)")
    .eq("id", changeOrderId)
    .eq("job_id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate Change Order", 500);
  if (!changeOrder) return jsonError("Change Order not found", 404);
  if (changeOrder.status !== "draft") return jsonError("Only draft Change Orders can be edited", 409);
  const jobRelation = changeOrder.jobs as unknown as { salesperson_id?: string | null };
  const scopeDenied = await requireOwnedMutation(session, "jobs", [jobRelation.salesperson_id ?? null]);
  if (scopeDenied) return scopeDenied;

  const items = Array.isArray(body.items) ? body.items as Array<Record<string, unknown>> : [];
  if (!items.length) return jsonError("At least one change item is required", 400);
  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity_delta);
    const price = Number(item.unit_price);
    return {
      org_id: session.org_id,
      change_order_id: changeOrderId,
      description: typeof item.description === "string" ? item.description.trim() : "",
      quantity_delta: quantity,
      unit_label: typeof item.unit_label === "string" ? item.unit_label.trim() || "unit" : "unit",
      unit_price: price,
      line_total: Math.round(quantity * price * 100) / 100,
      sort_order: index,
    };
  });
  if (normalizedItems.some((item) => !item.description || !Number.isFinite(item.quantity_delta) || item.quantity_delta === 0 || !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
    return jsonError("Every item requires a description, non-zero quantity, and valid unit price", 400);
  }
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.line_total, 0);
  const taxRate = Number(body.tax_rate ?? changeOrder.tax_rate ?? 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;

  const { error: updateError } = await admin.from("job_change_orders").update({
    title: typeof body.title === "string" ? body.title.trim() : changeOrder.title,
    reason: typeof body.reason === "string" ? body.reason.trim() : changeOrder.reason,
    description: typeof body.description === "string" ? body.description.trim() || null : changeOrder.description,
    requested_date: typeof body.requested_date === "string" ? body.requested_date : changeOrder.requested_date,
    po_strategy: body.po_strategy === "replacement" ? "replacement" : "supplemental",
    tax_name: typeof body.tax_name === "string" ? body.tax_name.trim() || null : changeOrder.tax_name,
    tax_rate: taxRate,
    subtotal,
    tax_amount: taxAmount,
    total_amount: subtotal + taxAmount,
    updated_by: session.user.id,
  }).eq("id", changeOrderId).eq("org_id", session.org_id);
  if (updateError) return jsonError(updateError.message, 409);

  const { error: deleteError } = await admin.from("job_change_order_items").delete().eq("change_order_id", changeOrderId).eq("org_id", session.org_id);
  if (deleteError) return jsonError("Change Order updated, but its old items could not be replaced", 500);
  const { error: insertError } = await admin.from("job_change_order_items").insert(normalizedItems);
  if (insertError) return jsonError("Change Order updated, but its items could not be saved", 500);
  return NextResponse.json({ success: true });
}
