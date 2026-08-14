import { NextResponse } from "next/server";

import {
  requireOrgPermission,
} from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  uploadInvoiceRequestDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

const invoiceTypes = new Set([
  "deposit",
  "progress",
  "final",
  "change_order",
  "credit_note",
]);
const amountTypes = new Set(["percentage", "remaining_balance", "fixed_amount"]);
const itemOptions = new Set([
  "tank_fabrication",
  "installation",
  "passivation",
  "freight",
  "engineering",
  "material_supplied",
  "change_order",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function formValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formatAddress(address: Record<string, unknown> | undefined) {
  if (!address) return null;
  return [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.province_state,
    address.postal_code,
    address.country,
  ]
    .filter(Boolean)
    .join(", ") || null;
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoice_requests", "view");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const admin = createAdminClient();
  let query = admin
    .from("invoice_requests")
    .select("*")
    .eq("org_id", session.org_id)
    .order("created_at", { ascending: false });
  const jobId = params.get("jobId")?.trim();
  const status = params.get("status")?.trim();
  if (jobId) query = query.eq("job_id", jobId);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) return jsonError("Unable to fetch invoice requests", 500);

  const requesterIds = Array.from(
    new Set((data ?? []).map((row) => row.requested_by).filter(Boolean)),
  );
  const { data: profiles, error: profilesError } = requesterIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", requesterIds)
    : { data: [], error: null };
  if (profilesError) return jsonError("Unable to fetch request owners", 500);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return NextResponse.json({
    requests: (data ?? []).map((row) => ({
      ...row,
      requester: row.requested_by ? profileMap.get(row.requested_by) ?? null : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoice_requests", "create");
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }
  const jobId = formValue(form, "job_id");
  const invoiceType = formValue(form, "invoice_type");
  const amountType = formValue(form, "amount_type");
  const amountValue = Number(formValue(form, "amount_value") || 0);
  const billingDescription = formValue(form, "billing_description");
  const comments = formValue(form, "comments_for_accounts") || null;
  let items: string[] = [];
  try {
    const parsed = JSON.parse(formValue(form, "items_to_include") || "[]");
    if (Array.isArray(parsed)) items = parsed.filter((item) => itemOptions.has(item));
  } catch {
    return jsonError("Items to include are invalid", 400);
  }
  if (!jobId || !invoiceTypes.has(invoiceType) || !amountTypes.has(amountType)) {
    return jsonError("Job, invoice type, and amount method are required", 400);
  }
  if (!billingDescription) return jsonError("Billing description is required", 400);
  if (!Number.isFinite(amountValue) || amountValue < 0) {
    return jsonError("Billing amount must be zero or greater", 400);
  }
  if (amountType === "percentage" && (amountValue <= 0 || amountValue > 100)) {
    return jsonError("Percentage must be between 0 and 100", 400);
  }
  if (amountType === "fixed_amount" && amountValue <= 0) {
    return jsonError("Fixed amount must be greater than zero", 400);
  }

  const files = form
    .getAll("supporting_documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  for (const file of files) {
    const validationError = validateDocument(file);
    if (validationError) return jsonError(`${file.name}: ${validationError}`, 400);
  }

  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_number,customer_id,latest_accepted_quotation_id,salesperson_id,job_status")
    .eq("id", jobId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (jobError) return jsonError("Unable to validate job", 500);
  if (!job || job.job_status === "po_pending") {
    return jsonError("A received purchase order is required", 409);
  }

  const [allocationResult, customerResult, quotationResult, salespersonResult] =
    await Promise.all([
      admin
        .from("job_purchase_order_allocations")
        .select("purchase_order_id,total_po_amount,quotation_number_snapshot,revision_number_snapshot,project_name_snapshot,tax_name_snapshot,tax_rate_snapshot")
        .eq("job_id", jobId)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      admin
        .from("customers")
        .select("id,company_name,credit_terms,gst_hst_number,tax_exempt,currency")
        .eq("id", job.customer_id)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      admin
        .from("quotations")
        .select("id,quotation_number,revision_number,project_name")
        .eq("id", job.latest_accepted_quotation_id)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      job.salesperson_id
        ? admin.from("profiles").select("full_name,email").eq("id", job.salesperson_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  const relationError =
    allocationResult.error ?? customerResult.error ?? quotationResult.error ?? salespersonResult.error;
  if (relationError) return jsonError("Unable to load billing context", 500);
  const allocation = allocationResult.data;
  const customer = customerResult.data;
  if (!allocation || !customer) return jsonError("Job billing context is incomplete", 409);

  const [poResult, addressesResult, contactResult, invoicesResult, requestsResult] =
    await Promise.all([
      admin
        .from("job_purchase_orders")
        .select("id,po_number,po_received_date,currency")
        .eq("id", allocation.purchase_order_id)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      admin
        .from("customer_addresses")
        .select("address_type,address_line_1,address_line_2,city,province_state,postal_code,country")
        .eq("customer_id", job.customer_id)
        .eq("org_id", session.org_id)
        .eq("status", "active"),
      admin
        .from("customer_contacts")
        .select("first_name,last_name,email,office_phone,mobile_number")
        .eq("customer_id", job.customer_id)
        .eq("org_id", session.org_id)
        .eq("status", "active")
        .order("is_primary", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin.from("job_invoices").select("invoice_amount").eq("job_id", jobId).eq("org_id", session.org_id),
      admin
        .from("invoice_requests")
        .select("requested_amount,status")
        .eq("job_id", jobId)
        .eq("org_id", session.org_id)
        .in("status", ["pending", "under_review"]),
    ]);
  const contextError =
    poResult.error ?? addressesResult.error ?? contactResult.error ?? invoicesResult.error ?? requestsResult.error;
  if (contextError) return jsonError("Unable to calculate request amount", 500);
  const po = poResult.data;
  if (!po) return jsonError("Purchase order not found", 404);

  const poTotal = Number(allocation.total_po_amount ?? 0);
  const committed = [...(invoicesResult.data ?? []), ...(requestsResult.data ?? [])].reduce(
    (sum, row) => sum + Number("invoice_amount" in row ? row.invoice_amount : row.requested_amount),
    0,
  );
  const remaining = Math.max(0, poTotal - committed);
  const requestedAmount =
    amountType === "percentage"
      ? Math.round(poTotal * amountValue) / 100
      : amountType === "remaining_balance"
        ? remaining
        : amountValue;
  if (invoiceType !== "credit_note" && requestedAmount > remaining + 0.005) {
    return jsonError("Requested amount exceeds the uncommitted PO balance", 409);
  }

  const addresses = (addressesResult.data ?? []) as Array<Record<string, unknown>>;
  const addressByType = new Map(addresses.map((address) => [String(address.address_type), address]));
  const headOffice = addressByType.get("head_office");
  const contact = contactResult.data;
  const quotation = quotationResult.data;
  const salesperson = salespersonResult.data;
  const taxText = customer.tax_exempt
    ? "Tax exempt"
    : [customer.gst_hst_number, allocation.tax_name_snapshot, allocation.tax_rate_snapshot != null
        ? `${allocation.tax_rate_snapshot}%`
        : null].filter(Boolean).join(" · ") || null;

  const { data: created, error: insertError } = await admin
    .from("invoice_requests")
    .insert({
      org_id: session.org_id,
      job_id: jobId,
      purchase_order_id: po.id,
      requested_by: session.user.id,
      invoice_type: invoiceType,
      amount_type: amountType,
      amount_value: amountType === "remaining_balance" ? remaining : amountValue,
      requested_amount: requestedAmount,
      billing_description: billingDescription,
      items_to_include: items,
      comments_for_accounts: comments,
      job_number_snapshot: job.job_number,
      po_number_snapshot: po.po_number,
      po_received_date_snapshot: po.po_received_date,
      customer_name_snapshot: customer.company_name,
      project_name_snapshot: quotation?.project_name ?? allocation.project_name_snapshot,
      quotation_number_snapshot: quotation?.quotation_number ?? allocation.quotation_number_snapshot,
      revision_number_snapshot: quotation?.revision_number ?? allocation.revision_number_snapshot,
      salesperson_snapshot: salesperson?.full_name ?? salesperson?.email ?? null,
      customer_contact_snapshot: contact
        ? `${contact.first_name} ${contact.last_name ?? ""}`.trim() +
          (contact.email ? ` · ${contact.email}` : "")
        : null,
      po_total_snapshot: poTotal,
      payment_terms_snapshot: customer.credit_terms,
      customer_tax_snapshot: taxText,
      customer_address_snapshot: formatAddress(headOffice),
      billing_address_snapshot: formatAddress(addressByType.get("billing") ?? headOffice),
      shipping_address_snapshot: formatAddress(addressByType.get("shipping")),
      currency: po.currency ?? customer.currency ?? "CAD",
      updated_by: session.user.id,
    })
    .select("*")
    .single();
  if (insertError || !created) return jsonError(insertError?.message ?? "Unable to submit request", 409);

  const uploadWarnings: string[] = [];
  for (const file of files) {
    const upload = await uploadInvoiceRequestDocument({
      admin,
      orgId: session.org_id,
      requestId: created.id,
      actorId: session.user.id,
      file,
    });
    if (upload.error) uploadWarnings.push(file.name);
  }

  const { data: accountMembers } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", session.org_id)
    .eq("status", "active")
    .in("role", ["accountant", "admin"]);
  if (accountMembers?.length) {
    await admin.from("crm_notifications").insert(
      accountMembers.map((member) => ({
        org_id: session.org_id,
        user_id: member.user_id,
        kind: "invoice_request_submitted",
        title: `Invoice request IR-${String(created.request_number).padStart(3, "0")} submitted`,
        message: `${created.customer_name_snapshot} · ${created.job_number_snapshot ?? "Job"}`,
        href: `/dashboard/invoice-requests/${created.id}`,
      })),
    );
  }

  return NextResponse.json(
    { request: created, upload_warnings: uploadWarnings },
    { status: 201 },
  );
}
