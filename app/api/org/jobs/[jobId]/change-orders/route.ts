import { NextResponse } from "next/server";

import { requireOwnedMutation } from "@/lib/auth/data-scope";
import {
  hasOrgPermission,
  requireOrgPermission,
} from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "change_orders", "view");
  if (denied) return denied;

  const { jobId } = await context.params;
  const admin = createAdminClient();
  const { data: changeOrders, error } = await admin
    .from("job_change_orders")
    .select("*")
    .eq("org_id", session.org_id)
    .eq("job_id", jobId)
    .order("sequence_number", { ascending: false });
  if (error) return jsonError("Unable to load Change Orders", 500);

  const ids = (changeOrders ?? []).map((changeOrder) => changeOrder.id);
  const [itemsResult, linksResult, activityResult, permissions] = await Promise.all([
    ids.length
      ? admin.from("job_change_order_items").select("*").eq("org_id", session.org_id).in("change_order_id", ids).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("job_change_order_purchase_orders").select("*,job_purchase_orders(id,po_number,po_received_date,current_po_total)").eq("org_id", session.org_id).in("change_order_id", ids)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? admin.from("job_change_order_activity").select("*").eq("org_id", session.org_id).in("change_order_id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    Promise.all([
      hasOrgPermission(session, "change_orders", "create"),
      hasOrgPermission(session, "change_orders", "edit"),
      hasOrgPermission(session, "change_orders", "approve"),
      hasOrgPermission(session, "change_orders", "cancel"),
    ]),
  ]);
  const relatedError = itemsResult.error ?? linksResult.error ?? activityResult.error;
  if (relatedError) return jsonError("Unable to load Change Order details", 500);

  return NextResponse.json({
    change_orders: (changeOrders ?? []).map((changeOrder) => ({
      ...changeOrder,
      items: (itemsResult.data ?? []).filter((item) => item.change_order_id === changeOrder.id),
      purchase_orders: (linksResult.data ?? []).filter((link) => link.change_order_id === changeOrder.id),
      activity: (activityResult.data ?? []).filter((activity) => activity.change_order_id === changeOrder.id),
    })),
    permissions: {
      can_create: permissions[0],
      can_edit: permissions[1],
      can_approve: permissions[2],
      can_cancel: permissions[3],
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "change_orders", "create");
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const { jobId } = await context.params;
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_status,salesperson_id")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError) return jsonError("Unable to validate job", 500);
  if (!job) return jsonError("Job not found", 404);
  const scopeDenied = await requireOwnedMutation(session, "jobs", [job.salesperson_id]);
  if (scopeDenied) return scopeDenied;

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return jsonError("At least one change item is required", 400);

  const client = await createSupabaseServerClient();
  const { data, error } = await client.rpc("create_job_change_order", {
    p_job_id: jobId,
    p_title: typeof body.title === "string" ? body.title.trim() : "",
    p_reason: typeof body.reason === "string" ? body.reason.trim() : "",
    p_description: typeof body.description === "string" ? body.description.trim() : "",
    p_requested_date: typeof body.requested_date === "string" ? body.requested_date : null,
    p_po_strategy: body.po_strategy === "replacement" ? "replacement" : "supplemental",
    p_currency: typeof body.currency === "string" ? body.currency : "CAD",
    p_tax_name: typeof body.tax_name === "string" ? body.tax_name.trim() : null,
    p_tax_rate: Number(body.tax_rate ?? 0),
    p_items: items,
  });
  if (error || !data) {
    return jsonError(error?.message ?? "Unable to create Change Order", 409);
  }
  return NextResponse.json({ id: data }, { status: 201 });
}
