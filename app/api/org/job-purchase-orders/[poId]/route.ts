import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
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
  const { poId } = await context.params;
  const result = await getPurchaseOrder(
    createAdminClient(),
    session.org_id,
    poId,
  );
  if (result.error) return jsonError("Unable to fetch purchase order", 500);
  if (!result.purchaseOrder) return jsonError("Purchase order not found", 404);
  return NextResponse.json({ purchase_order: result.purchaseOrder });
}

