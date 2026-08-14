import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/job-invoices/[invoiceId]/status">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!["draft", "sent", "payment_received"].includes(status)) {
    return jsonError("Invalid invoice status", 400);
  }
  const denied = await requireOrgPermission(
    session,
    "invoices",
    status === "payment_received" ? "record_payment" : "update_status",
  );
  if (denied) return denied;
  const { invoiceId } = await context.params;
  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from("job_invoices")
    .select("id,status")
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate invoice", 500);
  if (!invoice) return jsonError("Invoice not found", 404);
  if (invoice.status === status) return NextResponse.json({ invoice });
  const validTransition =
    (invoice.status === "draft" && status === "sent") ||
    (invoice.status === "sent" && status === "payment_received");
  if (!validTransition) return jsonError("Invalid invoice status transition", 409);

  const updates: Record<string, unknown> = {
    status,
    updated_by: session.user.id,
  };
  if (status === "payment_received") {
    const paymentDate =
      typeof body.payment_date === "string" ? body.payment_date.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return jsonError("Payment Date is required", 400);
    }
    updates.payment_date = paymentDate;
    if (typeof body.payment_reference_number === "string") {
      updates.payment_reference_number =
        body.payment_reference_number.trim() || null;
    }
    if (typeof body.payment_notes === "string") {
      updates.payment_notes = body.payment_notes.trim() || null;
    }
  }
  const { data: updated, error: updateError } = await admin
    .from("job_invoices")
    .update(updates)
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .select("*")
    .single();
  if (updateError || !updated) {
    return jsonError("Unable to update invoice status", 500);
  }
  const requestStatus =
    status === "sent" ? "sent_to_customer" : status === "payment_received" ? "paid" : null;
  if (requestStatus) {
    const { data: invoiceRequest } = await admin
      .from("invoice_requests")
      .update({
        status: requestStatus,
        closed_at: requestStatus === "paid" ? new Date().toISOString() : null,
        updated_by: session.user.id,
      })
      .eq("invoice_id", invoiceId)
      .eq("org_id", session.org_id)
      .select("id,requested_by,request_number")
      .maybeSingle();
    if (invoiceRequest?.requested_by) {
      await admin.from("crm_notifications").insert({
        org_id: session.org_id,
        user_id: invoiceRequest.requested_by,
        kind: requestStatus === "paid" ? "payment_received" : "invoice_sent",
        title:
          requestStatus === "paid"
            ? `Payment received for invoice ${updated.invoice_number}`
            : `Invoice ${updated.invoice_number} sent to customer`,
        message: `Request IR-${String(invoiceRequest.request_number).padStart(3, "0")}`,
        href: `/dashboard/invoices/${invoiceId}`,
      });
    }
  }
  return NextResponse.json({ invoice: updated });
}
