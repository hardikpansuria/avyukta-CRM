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
  current_revision_number: number | string;
  current_po_total: number | string;
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

type CompletionRow = {
  job_id: string;
  completion_status: string;
  completion_date: string;
  completed_at: string;
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
        remaining_uninvoiced: numeric(po.current_po_total) - totals.invoiced,
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

  const { data: revisionRows, error: revisionError } = await admin
    .from("job_purchase_order_revisions")
    .select("*")
    .eq("org_id", orgId)
    .eq("purchase_order_id", po.id)
    .order("revision_number", { ascending: false });
  if (revisionError) return { error: revisionError };

  const revisionIds = (revisionRows ?? []).map((revision) => revision.id);
  const creatorIds = Array.from(
    new Set(
      (revisionRows ?? [])
        .map((revision) => revision.created_by)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const [itemResult, creatorResult, completionResult] = await Promise.all([
    revisionIds.length
      ? admin
          .from("job_purchase_order_revision_items")
          .select("*")
          .eq("org_id", orgId)
          .in("revision_id", revisionIds)
          .order("quotation_number_snapshot")
      : Promise.resolve({ data: [], error: null }),
    creatorIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", creatorIds)
      : Promise.resolve({ data: [], error: null }),
    allocations.length
      ? admin
          .from("job_work_completions")
          .select("job_id,completion_status,completion_date,completed_at")
          .eq("org_id", orgId)
          .eq("generation_status", "generated")
          .in("job_id", allocations.map((allocation) => allocation.job_id))
          .order("completed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemResult.error || creatorResult.error || completionResult.error) {
    return { error: itemResult.error ?? creatorResult.error ?? completionResult.error };
  }
  const creators = new Map((creatorResult.data ?? []).map((row) => [row.id, row]));
  const completionByJob = new Map<string, CompletionRow>();
  for (const completion of (completionResult.data ?? []) as CompletionRow[]) {
    if (!completionByJob.has(completion.job_id)) {
      completionByJob.set(completion.job_id, completion);
    }
  }
  const documents = data.documents!.filter(
    (document) => document.purchase_order_id === po.id,
  );
  const documentById = new Map(documents.map((document) => [document.id, document]));
  const revisions = (revisionRows ?? []).map((revision) => ({
    ...revision,
    created_by_profile: revision.created_by
      ? (creators.get(revision.created_by) ?? null)
      : null,
    document: revision.document_id
      ? (documentById.get(revision.document_id) ?? null)
      : null,
    items: (itemResult.data ?? [])
      .filter((item) => item.revision_id === revision.id)
      .map((item) => ({
        ...item,
        current_job_status: jobs.get(item.job_id)?.job_status ?? item.job_status_snapshot,
        current_job_number: jobs.get(item.job_id)?.job_number ?? item.job_number_snapshot,
        current_completion: completionByJob.get(item.job_id) ?? null,
      })),
  }));
  const currentAllocationIds = new Set(
    (revisions[0]?.items ?? [])
      .filter((item: { is_included: boolean }) => item.is_included)
      .map((item: { allocation_id: string }) => item.allocation_id),
  );
  const { data: primaryContact, error: contactError } = await admin
    .from("customer_contacts")
    .select("id,first_name,last_name,email,mobile_number,office_phone")
    .eq("org_id", orgId)
    .eq("customer_id", po.customer_id)
    .eq("status", "active")
    .eq("is_primary", true)
    .maybeSingle();
  if (contactError) return { error: contactError };

  return {
    error: null,
    purchaseOrder: {
      ...po,
      customer: customer ?? null,
      customer_contact: primaryContact ?? null,
      allocations: allocations.map((allocation) => ({
        ...allocation,
        is_currently_included: currentAllocationIds.has(allocation.id),
      })),
      documents,
      revisions,
      ...totals,
      remaining_uninvoiced: numeric(po.current_po_total) - totals.invoiced,
    },
  };
}
