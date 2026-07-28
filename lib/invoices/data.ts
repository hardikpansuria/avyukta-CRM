import type { SupabaseClient } from "@supabase/supabase-js";

type InvoiceRow = {
  id: string;
  job_id: string;
  purchase_order_id: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  invoice_amount: number | string;
  status: "draft" | "sent" | "payment_received";
  sent_at?: string | null;
  payment_date?: string | null;
  payment_reference_number?: string | null;
  payment_notes?: string | null;
  remarks?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function invoiceAging(invoice: {
  status: string;
  sent_at?: string | null;
  payment_date?: string | null;
}) {
  if (!invoice.sent_at) {
    return { days_outstanding: 0, aging_bucket: "current" as const };
  }
  const start = new Date(invoice.sent_at);
  const end =
    invoice.status === "payment_received" && invoice.payment_date
      ? new Date(`${invoice.payment_date}T23:59:59.999Z`)
      : new Date();
  const days = Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 86_400_000),
  );
  const bucket =
    days === 0
      ? "current"
      : days <= 30
        ? "1_30"
        : days <= 60
          ? "31_60"
          : days <= 90
            ? "61_90"
            : "91_plus";
  return { days_outstanding: days, aging_bucket: bucket };
}

async function getInvoiceRelations(admin: SupabaseClient, orgId: string) {
  const [invoiceResult, poResult, jobResult, allocationResult, customerResult] =
    await Promise.all([
      admin
        .from("job_invoices")
        .select("*")
        .eq("org_id", orgId)
        .order("invoice_date", { ascending: false }),
      admin
        .from("job_purchase_orders")
        .select("id,customer_id,po_number,currency,combined_po_total")
        .eq("org_id", orgId),
      admin
        .from("jobs")
        .select(
          "id,job_number,customer_id,latest_accepted_quotation_id,job_status",
        )
        .eq("org_id", orgId),
      admin
        .from("job_purchase_order_allocations")
        .select(
          "id,job_id,purchase_order_id,quotation_number_snapshot,revision_number_snapshot,project_name_snapshot,total_po_amount",
        )
        .eq("org_id", orgId),
      admin
        .from("customers")
        .select("id,company_name,currency")
        .eq("org_id", orgId),
    ]);
  const error =
    invoiceResult.error ??
    poResult.error ??
    jobResult.error ??
    allocationResult.error ??
    customerResult.error;
  if (error) return { error };
  return {
    error: null,
    invoices: (invoiceResult.data ?? []) as InvoiceRow[],
    purchaseOrders: poResult.data ?? [],
    jobs: jobResult.data ?? [],
    allocations: allocationResult.data ?? [],
    customers: customerResult.data ?? [],
  };
}

export async function listInvoices(
  admin: SupabaseClient,
  orgId: string,
  filters: {
    customer?: string;
    po?: string;
    job?: string;
    invoice?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    aging?: string;
  } = {},
) {
  const data = await getInvoiceRelations(admin, orgId);
  if (data.error || !data.invoices) return { error: data.error };
  const purchaseOrders = new Map(
    data.purchaseOrders!.map((row) => [row.id as string, row]),
  );
  const jobs = new Map(data.jobs!.map((row) => [row.id as string, row]));
  const allocations = new Map(
    data.allocations!.map((row) => [row.job_id as string, row]),
  );
  const customers = new Map(
    data.customers!.map((row) => [row.id as string, row]),
  );
  const includes = (value: unknown, query: string | undefined) =>
    !query ||
    String(value ?? "")
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase());

  const invoices = data.invoices
    .map((invoice) => {
      const job = jobs.get(invoice.job_id) ?? null;
      const po = purchaseOrders.get(invoice.purchase_order_id) ?? null;
      const customer = po ? (customers.get(po.customer_id as string) ?? null) : null;
      return {
        ...invoice,
        job,
        purchase_order: po,
        customer,
        allocation: allocations.get(invoice.job_id) ?? null,
        ...invoiceAging(invoice),
      };
    })
    .filter((invoice) => {
      if (!includes(invoice.customer?.company_name, filters.customer)) return false;
      if (!includes(invoice.purchase_order?.po_number, filters.po)) return false;
      if (!includes(invoice.job?.job_number, filters.job)) return false;
      if (!includes(invoice.invoice_number, filters.invoice)) return false;
      if (filters.status && invoice.status !== filters.status) return false;
      if (filters.dateFrom && invoice.invoice_date < filters.dateFrom) return false;
      if (filters.dateTo && invoice.invoice_date > filters.dateTo) return false;
      if (filters.aging && invoice.aging_bucket !== filters.aging) return false;
      return true;
    });

  const poIds = Array.from(
    new Set(invoices.map((invoice) => invoice.purchase_order_id)),
  );
  const groups = poIds.map((poId) => {
    const po = purchaseOrders.get(poId)!;
    const poInvoices = data.invoices!.filter(
      (invoice) => invoice.purchase_order_id === poId,
    );
    const totals = poInvoices.reduce(
      (result, invoice) => {
        const value = numeric(invoice.invoice_amount);
        result.invoiced += value;
        if (invoice.status === "payment_received") result.paid += value;
        if (invoice.status === "sent") result.outstanding += value;
        return result;
      },
      { invoiced: 0, paid: 0, outstanding: 0 },
    );
    return {
      purchase_order: po,
      customer: customers.get(po.customer_id as string) ?? null,
      invoices: invoices.filter((invoice) => invoice.purchase_order_id === poId),
      ...totals,
    };
  });
  return { error: null, groups, invoices };
}

export async function getInvoiceDetail(
  admin: SupabaseClient,
  orgId: string,
  invoiceId: string,
) {
  const { data: invoice, error: invoiceError } = await admin
    .from("job_invoices")
    .select("*")
    .eq("id", invoiceId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (invoiceError || !invoice) return { error: invoiceError, invoice: null };
  const [jobResult, poResult, allocationResult, documentResult, historyResult] =
    await Promise.all([
      admin
        .from("jobs")
        .select("id,job_number,customer_id,latest_accepted_quotation_id,job_status")
        .eq("id", invoice.job_id)
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("job_purchase_orders")
        .select("id,customer_id,po_number,currency,combined_po_total")
        .eq("id", invoice.purchase_order_id)
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("job_purchase_order_allocations")
        .select("*")
        .eq("job_id", invoice.job_id)
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("job_invoice_documents")
        .select("*")
        .eq("invoice_id", invoiceId)
        .eq("org_id", orgId)
        .order("uploaded_at", { ascending: false }),
      admin
        .from("job_invoice_status_history")
        .select("*")
        .eq("invoice_id", invoiceId)
        .eq("org_id", orgId)
        .order("changed_at", { ascending: false }),
    ]);
  const error =
    jobResult.error ??
    poResult.error ??
    allocationResult.error ??
    documentResult.error ??
    historyResult.error;
  if (error) return { error, invoice: null };

  const [customerResult, quotationResult] = await Promise.all([
    jobResult.data?.customer_id
      ? admin
          .from("customers")
          .select("id,company_name,currency")
          .eq("id", jobResult.data.customer_id)
          .eq("org_id", orgId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    jobResult.data?.latest_accepted_quotation_id
      ? admin
          .from("quotations")
          .select("id,quotation_number,revision_number,project_name")
          .eq("id", jobResult.data.latest_accepted_quotation_id)
          .eq("org_id", orgId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (customerResult.error || quotationResult.error) {
    return {
      error: customerResult.error ?? quotationResult.error,
      invoice: null,
    };
  }
  return {
    error: null,
    invoice: {
      ...invoice,
      job: jobResult.data,
      purchase_order: poResult.data,
      allocation: allocationResult.data,
      customer: customerResult.data,
      quotation: quotationResult.data,
      documents: documentResult.data ?? [],
      status_history: historyResult.data ?? [],
      ...invoiceAging(invoice),
      outstanding_balance:
        invoice.status === "sent" ? numeric(invoice.invoice_amount) : 0,
    },
  };
}

