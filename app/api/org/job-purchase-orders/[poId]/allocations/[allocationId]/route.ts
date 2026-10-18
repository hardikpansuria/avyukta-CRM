import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function DELETE(
  request: Request,
  context: RouteContext<
    "/api/org/job-purchase-orders/[poId]/allocations/[allocationId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "delete");
  if (denied) return denied;
  const { poId, allocationId } = await context.params;
  const admin = createAdminClient();
  const { data: allocation, error: allocationError } = await admin
    .from("job_purchase_order_allocations")
    .select("id,job_id,quotation_id_snapshot,is_active")
    .eq("id", allocationId)
    .eq("purchase_order_id", poId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (allocationError) return jsonError("Unable to validate Purchase Order attachment", 500);
  if (!allocation?.is_active) return jsonError("Active Purchase Order attachment not found", 404);

  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("salesperson_id")
    .eq("id", allocation.job_id)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError || !job) return jsonError("Unable to validate Purchase Order job", 500);
  const scopeDenied = await requireOwnedMutation(
    session,
    "purchase_orders",
    [job.salesperson_id],
  );
  if (scopeDenied) return scopeDenied;

  let reason: string | null = null;
  try {
    const body = (await request.json()) as { reason?: unknown };
    reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
  } catch {
    // A removal reason is optional.
  }

  const authenticated = await createSupabaseServerClient();
  const { error: rpcError } = await authenticated.rpc(
    "unlink_job_purchase_order_allocation",
    { p_allocation_id: allocationId, p_reason: reason },
  );
  if (rpcError) {
    const conflict = /invoicing|completed-work|Active Purchase Order/i.test(rpcError.message);
    return jsonError(rpcError.message || "Unable to remove Purchase Order", conflict ? 409 : 500);
  }

  return NextResponse.json({
    removed: true,
    quotation_id: allocation.quotation_id_snapshot,
    job_id: allocation.job_id,
  });
}
