import type { SupabaseClient } from "@supabase/supabase-js";

type PurchaseOrderRow = {
  id: string;
  customer_id: string;
  po_number: string;
  po_received_date: string;
  currency: string;
  combined_quotation_total: number | string;
  combined_po_amount_before_tax: number | string;
  combined_tax_amount: number | string;
  combined_po_total: number | string;
  difference_amount: number | string;
  internal_remarks?: string | null;
  created_at?: string | null;
};

type AllocationRow = {
  id: string;
  purchase_order_id: string;
  job_id: string;
  quotation_number_snapshot: string;
  revision_number_snapshot: number | string;
  project_name_snapshot?: string | null;
  quotation_total: number | string;
  total_po_amount: number | string;
  difference_amount: number | string;
};

type InvoiceRow = {
  id: string;
  purchase_order_id: string;
  job_id: string;
  invoice_number: string;
  invoice_amount: number | string;
  status: string;
};

type JobRow = {
  id: string;
  job_number?: string | null;
  job_status: string;
};

type CustomerRow = {
  id: string;
  company_name: string;
};

function numeric(value: number | string | null | undefined) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function invoiceTotals(invoices: InvoiceRow[]) {
  return invoices.reduce(
    (totals, invoice) => {
      const value = numeric(invoice.invoice_amount);
      totals.invoiced += value;
      if (invoice.status === "payment_received") totals.paid += value;
      if (invoice.status === "sent") totals.outstanding += value;
      return totals;
    },
    { invoiced: 0, paid: 0, outstanding: 0 },
  );
}

export async function getPurchaseOrderData(
  admin: SupabaseClient,
  orgId: string,
) {
  const [
    purchaseOrderResult,
    allocationResult,
    invoiceResult,
    documentResult,
  ] = await Promise.all([
    admin
      .from("job_purchase_orders")
      .select("*")
      .eq("org_id", orgId)
      .order("po_received_date", { ascending: false }),
    admin
      .from("job_purchase_order_allocations")
      .select(
        "id,purchase_order_id,job_id,quotation_number_snapshot,revision_number_snapshot,project_name_snapshot,quotation_total,total_po_amount,difference_amount",
      )
      .eq("org_id", orgId),
    admin
      .from("job_invoices")
      .select(
        "id,purchase_order_id,job_id,invoice_number,invoice_amount,status",
      )
      .eq("org_id", orgId),
    admin
      .from("job_purchase_order_documents")
      .select("*")
      .eq("org_id", orgId)
      .order("uploaded_at", { ascending: false }),
  ]);

  const baseError =
    purchaseOrderResult.error ??
    allocationResult.error ??
    invoiceResult.error ??
    documentResult.error;
  if (baseError) return { error: baseError };

  const purchaseOrders = (purchaseOrderResult.data ?? []) as PurchaseOrderRow[];
  const allocations = (allocationResult.data ?? []) as AllocationRow[];
  const invoices = (invoiceResult.data ?? []) as InvoiceRow[];
  const customerIds = Array.from(
    new Set(purchaseOrders.map((po) => po.customer_id)),
  );
  const jobIds = Array.from(new Set(allocations.map((row) => row.job_id)));
  const [customerResult, jobResult] = await Promise.all([
    customerIds.length
      ? admin
          .from("customers")
          .select("id,company_name")
          .eq("org_id", orgId)
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? admin
          .from("jobs")
          .select("id,job_number,job_status")
          .eq("org_id", orgId)
          .in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = customerResult.error ?? jobResult.error;
  if (relatedError) return { error: relatedError };

  return {
    error: null,
    purchaseOrders,
    allocations,
    invoices,
    documents: documentResult.data ?? [],
    customers: (customerResult.data ?? []) as CustomerRow[],
    jobs: (jobResult.data ?? []) as JobRow[],
  };
}

export async function listPurchaseOrders(
  admin: SupabaseClient,
  orgId: string,
  options: { search?: string; page?: number; pageSize?: number } = {},
) {
  const data = await getPurchaseOrderData(admin, orgId);
  if (data.error || !data.purchaseOrders) return { error: data.error };

  const customers = new Map(data.customers!.map((row) => [row.id, row]));
  const jobs = new Map(data.jobs!.map((row) => [row.id, row]));
  const query = (options.search ?? "").trim().toLocaleLowerCase();
  const items = data.purchaseOrders
    .map((po) => {
      const allocations = data.allocations!.filter(
        (row) => row.purchase_order_id === po.id,
      );
      const poInvoices = data.invoices!.filter(
        (row) => row.purchase_order_id === po.id,
      );
      const totals = invoiceTotals(poInvoices);
      const includedJobs = allocations.map((allocation) => ({
        ...allocation,
        job: jobs.get(allocation.job_id) ?? null,
      }));
      const statuses = new Map<string, number>();
      includedJobs.forEach(({ job }) => {
        const status = job?.job_status ?? "unknown";
        statuses.set(status, (statuses.get(status) ?? 0) + 1);
      });
      return {
        ...po,
        customer: customers.get(po.customer_id) ?? null,
        job_count: allocations.length,
        jobs: includedJobs,
        ...totals,
        remaining_uninvoiced: numeric(po.combined_po_total) - totals.invoiced,
        production_summary: Array.from(statuses.entries()).map(
          ([status, count]) => ({ status, count }),
        ),
      };
    })
    .filter((po) => {
      if (!query) return true;
      return [
        po.po_number,
        po.customer?.company_name,
        ...po.jobs.flatMap(({ job, ...allocation }) => [
          job?.job_number,
          allocation.quotation_number_snapshot,
          allocation.project_name_snapshot,
        ]),
      ].some((value) =>
        String(value ?? "").toLocaleLowerCase().includes(query),
      );
    });

  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const start = (page - 1) * pageSize;
  return {
    error: null,
    purchaseOrders: items.slice(start, start + pageSize),
    total: items.length,
    page,
    pageSize,
  };
}

export async function getPurchaseOrder(
  admin: SupabaseClient,
  orgId: string,
  purchaseOrderId: string,
) {
  const data = await getPurchaseOrderData(admin, orgId);
  if (data.error || !data.purchaseOrders) return { error: data.error };
  const po = data.purchaseOrders.find((row) => row.id === purchaseOrderId);
  if (!po) return { error: null, purchaseOrder: null };

  const customer = data.customers!.find((row) => row.id === po.customer_id);
  const jobs = new Map(data.jobs!.map((row) => [row.id, row]));
  const allocations = data.allocations!
    .filter((row) => row.purchase_order_id === po.id)
    .map((allocation) => {
      const jobInvoices = data.invoices!.filter(
        (invoice) => invoice.job_id === allocation.job_id,
      );
      return {
        ...allocation,
        job: jobs.get(allocation.job_id) ?? null,
        invoices: jobInvoices,
        ...invoiceTotals(jobInvoices),
      };
    });
  const totals = invoiceTotals(
    data.invoices!.filter((invoice) => invoice.purchase_order_id === po.id),
  );

  return {
    error: null,
    purchaseOrder: {
      ...po,
      customer: customer ?? null,
      allocations,
      documents: data.documents!.filter(
        (document) => document.purchase_order_id === po.id,
      ),
      ...totals,
      remaining_uninvoiced: numeric(po.combined_po_total) - totals.invoiced,
    },
  };
}

