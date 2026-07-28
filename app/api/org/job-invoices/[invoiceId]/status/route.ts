import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
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
  return NextResponse.json({ invoice: updated });
}

