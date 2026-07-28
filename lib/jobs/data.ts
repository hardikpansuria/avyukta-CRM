import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CustomerSummary,
  JobListItem,
  JobStatus,
  ProfileSummary,
  QuotationSummary,
} from "@/lib/jobs/types";

type JobRow = {
  id: string;
  quotation_series_id: string;
  latest_accepted_quotation_id: string;
  customer_id: string;
  job_number?: string | null;
  job_status: JobStatus;
  accepted_at?: string | null;
  salesperson_id?: string | null;
};

function includesSearch(item: JobListItem, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    item.job_number,
    item.quotation?.quotation_number,
    item.quotation?.project_name,
    item.customer?.company_name,
  ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query));
}

export async function listJobs(
  admin: SupabaseClient,
  orgId: string,
  options: {
    status?: JobStatus;
    search?: string;
    page?: number;
    pageSize?: number;
    customerId?: string;
  } = {},
) {
  let query = admin
    .from("jobs")
    .select(
      "id,quotation_series_id,latest_accepted_quotation_id,customer_id,job_number,job_status,accepted_at,salesperson_id",
    )
    .eq("org_id", orgId)
    .order("accepted_at", { ascending: false });

  if (options.status) query = query.eq("job_status", options.status);
  if (options.customerId) query = query.eq("customer_id", options.customerId);

  const { data: rows, error } = await query;
  if (error) return { error, jobs: [] as JobListItem[], total: 0 };

  const jobs = (rows ?? []) as JobRow[];
  const quotationIds = Array.from(
    new Set(jobs.map((job) => job.latest_accepted_quotation_id).filter(Boolean)),
  );
  const customerIds = Array.from(
    new Set(jobs.map((job) => job.customer_id).filter(Boolean)),
  );
  const profileIds = Array.from(
    new Set(jobs.map((job) => job.salesperson_id).filter(Boolean) as string[]),
  );

  const [quotationResult, customerResult, profileResult] = await Promise.all([
    quotationIds.length
      ? admin
          .from("quotations")
          .select(
            "id,quotation_number,revision_number,project_name,grand_total_after_tax,grand_total_before_tax,tax_name,tax_rate",
          )
          .eq("org_id", orgId)
          .in("id", quotationIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length
      ? admin
          .from("customers")
          .select("id,company_name,currency")
          .eq("org_id", orgId)
          .in("id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    profileIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError =
    quotationResult.error ?? customerResult.error ?? profileResult.error;
  if (relatedError) {
    return { error: relatedError, jobs: [] as JobListItem[], total: 0 };
  }

  const quotations = new Map(
    ((quotationResult.data ?? []) as QuotationSummary[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const customers = new Map(
    ((customerResult.data ?? []) as CustomerSummary[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const profiles = new Map(
    ((profileResult.data ?? []) as ProfileSummary[]).map((row) => [
      row.id,
      row,
    ]),
  );

  const filtered = jobs
    .map((job): JobListItem => ({
      ...job,
      quotation: quotations.get(job.latest_accepted_quotation_id) ?? null,
      customer: customers.get(job.customer_id) ?? null,
      salesperson: job.salesperson_id
        ? (profiles.get(job.salesperson_id) ?? null)
        : null,
    }))
    .filter((job) => includesSearch(job, options.search ?? ""));

  const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
  const page = Math.max(options.page ?? 1, 1);
  const start = (page - 1) * pageSize;

  return {
    error: null,
    jobs: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function getJobDetail(
  admin: SupabaseClient,
  orgId: string,
  jobId: string,
) {
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (jobError || !job) return { error: jobError, job: null };

  const [
    quotationResult,
    customerResult,
    profileResult,
    allocationResult,
    invoiceResult,
    historyResult,
    quotationHistoryResult,
  ] = await Promise.all([
    admin
      .from("quotations")
      .select(
        "id,quotation_number,revision_number,project_name,grand_total_after_tax,grand_total_before_tax,tax_name,tax_rate",
      )
      .eq("id", job.latest_accepted_quotation_id)
      .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("customers")
      .select("id,company_name,currency")
      .eq("id", job.customer_id)
      .eq("org_id", orgId)
      .maybeSingle(),
    job.salesperson_id
      ? admin
          .from("profiles")
          .select("id,full_name,email")
          .eq("id", job.salesperson_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("job_purchase_order_allocations")
      .select("*")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("job_invoices")
      .select("*")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .order("invoice_date", { ascending: false }),
    admin
      .from("job_status_history")
      .select("*")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .order("changed_at", { ascending: false }),
    admin
      .from("job_quotation_history")
      .select("id,quotation_id,revision_number,accepted_at,accepted_by")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .order("accepted_at", { ascending: false }),
  ]);

  const relatedError =
    quotationResult.error ??
    customerResult.error ??
    profileResult.error ??
    allocationResult.error ??
    invoiceResult.error ??
    historyResult.error ??
    quotationHistoryResult.error;
  if (relatedError) return { error: relatedError, job: null };

  const allocation = allocationResult.data;
  const purchaseOrderResult = allocation?.purchase_order_id
    ? await admin
        .from("job_purchase_orders")
        .select("id,po_number,po_received_date,currency")
        .eq("id", allocation.purchase_order_id)
        .eq("org_id", orgId)
        .maybeSingle()
    : { data: null, error: null };
  if (purchaseOrderResult.error) {
    return { error: purchaseOrderResult.error, job: null };
  }

  const history = historyResult.data ?? [];
  const historyProfileIds = Array.from(
    new Set(
      history
        .map((event) => event.changed_by as string | null)
        .filter(Boolean) as string[],
    ),
  );
  const historyProfilesResult = historyProfileIds.length
    ? await admin
        .from("profiles")
        .select("id,full_name,email")
        .in("id", historyProfileIds)
    : { data: [], error: null };
  if (historyProfilesResult.error) {
    return { error: historyProfilesResult.error, job: null };
  }
  const historyProfiles = new Map(
    (historyProfilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );

  const invoices = invoiceResult.data ?? [];
  const totals = invoices.reduce(
    (result, invoice) => {
      const value = Number(invoice.invoice_amount ?? 0);
      result.invoiced += value;
      if (invoice.status === "payment_received") result.paid += value;
      if (invoice.status === "sent") result.outstanding += value;
      return result;
    },
    { invoiced: 0, paid: 0, outstanding: 0 },
  );
  const allocationTotal = Number(allocation?.total_po_amount ?? 0);

  return {
    error: null,
    job: {
      ...job,
      quotation: quotationResult.data,
      customer: customerResult.data,
      salesperson: profileResult.data,
      allocation,
      purchase_order: purchaseOrderResult.data,
      invoices,
      status_history: history.map((event) => ({
        ...event,
        changed_by_profile: event.changed_by
          ? (historyProfiles.get(event.changed_by as string) ?? null)
          : null,
      })),
      quotation_history: quotationHistoryResult.data ?? [],
      totals: {
        allocated_po_total: allocationTotal,
        ...totals,
        remaining_uninvoiced: allocationTotal - totals.invoiced,
      },
    },
  };
}
