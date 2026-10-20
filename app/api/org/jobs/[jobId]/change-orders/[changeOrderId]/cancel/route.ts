import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string; changeOrderId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "change_orders", "cancel");
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return jsonError("Cancellation reason is required", 400);

  const { jobId, changeOrderId } = await context.params;
  const admin = createAdminClient();
  const { data: changeOrder, error } = await admin
    .from("job_change_orders")
    .select("id,status,job_id,jobs!inner(job_status,salesperson_id)")
    .eq("id", changeOrderId)
    .eq("job_id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate Change Order", 500);
  if (!changeOrder) return jsonError("Change Order not found", 404);
  if (changeOrder.status === "cancelled") return jsonError("Change Order is already cancelled", 409);
  const job = changeOrder.jobs as unknown as { job_status: string; salesperson_id?: string | null };
  const scopeDenied = await requireOwnedMutation(session, "jobs", [job.salesperson_id ?? null]);
  if (scopeDenied) return scopeDenied;

  const client = await createSupabaseServerClient();
  const { error: cancelError } = await client.rpc("cancel_job_change_order", {
    p_change_order_id: changeOrderId,
    p_reason: reason,
  });
  if (cancelError) return jsonError(cancelError.message, 409);
  return NextResponse.json({ success: true });
}
