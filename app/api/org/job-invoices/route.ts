import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { listInvoices, numeric } from "@/lib/invoices/data";
import {
  uploadInvoiceDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "view");
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const result = await listInvoices(createAdminClient(), session.org_id, {
    customer: params.get("customer")?.trim() ?? "",
    po: params.get("po")?.trim() ?? "",
    job: params.get("job")?.trim() ?? "",
    invoice: params.get("invoice")?.trim() ?? "",
    status: params.get("status")?.trim() ?? "",
    dateFrom: params.get("dateFrom")?.trim() ?? "",
    dateTo: params.get("dateTo")?.trim() ?? "",
    aging: params.get("aging")?.trim() ?? "",
  });
  if (result.error) return jsonError("Unable to fetch invoices", 500);
  return NextResponse.json({ groups: result.groups ?? [] });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "create");
  if (denied) return denied;
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }
  const value = (key: string) => {
    const entry = form.get(key);
    return typeof entry === "string" ? entry.trim() : "";
  };
  const jobId = value("job_id");
  const customerId = value("customer_id");
  const invoiceNumber = value("invoice_number");
  const invoiceDate = value("invoice_date");
  const invoiceAmount = Number(value("invoice_amount"));
  const remarks = value("remarks") || null;
  const overInvoicingAcknowledged =
    value("over_invoicing_acknowledged") === "true";
  if (!customerId || !jobId || !invoiceNumber) {
    return jsonError("Customer, Job, and Invoice Number are required", 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) {
    return jsonError("Invoice Date is required", 400);
  }
  if (!Number.isFinite(invoiceAmount) || invoiceAmount < 0) {
    return jsonError("Invoice Amount must be zero or greater", 400);
  }

  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_status,customer_id")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError) return jsonError("Unable to validate job", 500);
  if (!job) return jsonError("Job not found", 404);
  if (job.customer_id !== customerId) {
    return jsonError("Selected job does not belong to the customer", 400);
  }
  const { data: allocation, error: allocationError } = await admin
    .from("job_purchase_order_allocations")
    .select("purchase_order_id,total_po_amount")
    .eq("job_id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (allocationError) return jsonError("Unable to validate PO allocation", 500);
  if (!allocation) return jsonError("Job does not have a purchase order", 409);
  const { data: purchaseOrder, error: purchaseOrderError } = await admin
    .from("job_purchase_orders")
    .select("id,currency")
    .eq("id", allocation.purchase_order_id)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (purchaseOrderError) {
    return jsonError("Unable to validate purchase order", 500);
  }
  if (!purchaseOrder) return jsonError("Purchase order not found", 404);
  const { data: previousInvoices, error: invoicesError } = await admin
    .from("job_invoices")
    .select("invoice_amount")
    .eq("job_id", jobId)
    .eq("org_id", session.org_id);
  if (invoicesError) return jsonError("Unable to validate invoice total", 500);
  const previouslyInvoiced = (previousInvoices ?? []).reduce(
    (sum, invoice) => sum + numeric(invoice.invoice_amount),
    0,
  );
  const overBy =
    previouslyInvoiced + invoiceAmount - numeric(allocation.total_po_amount);
  if (overBy > 0.005 && !overInvoicingAcknowledged) {
    return jsonError(
      "Invoice total exceeds the job PO allocation. Acknowledgement is required.",
      409,
    );
  }

  const { data: invoice, error: insertError } = await admin
    .from("job_invoices")
    .insert({
      org_id: session.org_id,
      job_id: jobId,
      purchase_order_id: allocation.purchase_order_id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      invoice_amount: invoiceAmount,
      currency: purchaseOrder.currency ?? "CAD",
      status: "draft",
      remarks,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("*")
    .single();
  if (insertError || !invoice) {
    return jsonError(insertError?.message || "Unable to create invoice", 409);
  }

  let documentWarning: string | null = null;
  const fileEntry = form.get("invoice_pdf");
  if (fileEntry instanceof File && fileEntry.size > 0) {
    const validationError = validateDocument(fileEntry, { pdfOnly: true });
    if (validationError) {
      documentWarning = `Invoice created, but the PDF was not uploaded: ${validationError}`;
    } else {
      const upload = await uploadInvoiceDocument({
        admin,
        orgId: session.org_id,
        jobId,
        invoiceId: invoice.id,
        actorId: session.user.id,
        file: fileEntry,
      });
      if (upload.error) {
        documentWarning =
          "Invoice created, but the PDF upload failed. Retry from invoice detail.";
      }
    }
  }
  return NextResponse.json(
    { invoice, document_warning: documentWarning },
    { status: 201 },
  );
}
