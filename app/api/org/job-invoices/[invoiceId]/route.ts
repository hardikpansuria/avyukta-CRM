import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { getInvoiceDetail, numeric } from "@/lib/invoices/data";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/job-invoices/[invoiceId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "view");
  if (denied) return denied;
  const { invoiceId } = await context.params;
  const result = await getInvoiceDetail(
    createAdminClient(),
    session.org_id,
    invoiceId,
  );
  if (result.error) return jsonError("Unable to fetch invoice", 500);
  if (!result.invoice) return jsonError("Invoice not found", 404);
  return NextResponse.json({ invoice: result.invoice });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/job-invoices/[invoiceId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "edit");
  if (denied) return denied;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const { invoiceId } = await context.params;
  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from("job_invoices")
    .select("id,job_id,status,invoice_amount")
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate invoice", 500);
  if (!invoice) return jsonError("Invoice not found", 404);
  if (invoice.status !== "draft") {
    return jsonError("Only draft invoices can be edited", 409);
  }
  const invoiceAmount =
    body.invoice_amount === undefined
      ? numeric(invoice.invoice_amount)
      : Number(body.invoice_amount);
  if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
    return jsonError("Invoice Amount must be zero or greater", 400);
  }
  const [allocationResult, otherInvoicesResult] = await Promise.all([
    admin
      .from("job_purchase_order_allocations")
      .select("total_po_amount")
      .eq("job_id", invoice.job_id)
      .eq("org_id", session.org_id)
      .maybeSingle(),
    admin
      .from("job_invoices")
      .select("invoice_amount")
      .eq("job_id", invoice.job_id)
      .eq("org_id", session.org_id)
      .neq("id", invoiceId),
  ]);
  if (allocationResult.error || otherInvoicesResult.error) {
    return jsonError("Unable to validate invoice total", 500);
  }
  const otherTotal = (otherInvoicesResult.data ?? []).reduce(
    (sum, row) => sum + numeric(row.invoice_amount),
    0,
  );
  if (
    otherTotal + invoiceAmount >
      numeric(allocationResult.data?.total_po_amount) + 0.005 &&
    body.over_invoicing_acknowledged !== true
  ) {
    return jsonError("Over-invoicing acknowledgement is required", 409);
  }
  const updates: Record<string, unknown> = {
    invoice_amount: invoiceAmount,
    updated_by: session.user.id,
  };
  if (typeof body.invoice_number === "string") {
    if (!body.invoice_number.trim()) return jsonError("Invoice Number is required", 400);
    updates.invoice_number = body.invoice_number.trim();
  }
  if (typeof body.invoice_date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.invoice_date)) {
      return jsonError("Invoice Date is invalid", 400);
    }
    updates.invoice_date = body.invoice_date;
  }
  if (body.remarks === null || typeof body.remarks === "string") {
    updates.remarks =
      typeof body.remarks === "string" ? body.remarks.trim() || null : null;
  }
  const { data: updated, error: updateError } = await admin
    .from("job_invoices")
    .update(updates)
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .select("*")
    .single();
  if (updateError || !updated) return jsonError("Unable to update invoice", 500);
  return NextResponse.json({ invoice: updated });
}
