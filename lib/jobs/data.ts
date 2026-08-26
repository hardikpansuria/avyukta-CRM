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
  latest_work_completion_id?: string | null;
};

type CompletionListRow = NonNullable<JobListItem["completion"]> & { job_id: string };

function includesSearch(item: JobListItem, search: string) {
  const query = search.trim().toLocaleLowerCase();
  if (!query) return true;

  return [
    item.job_number,
    item.quotation?.quotation_number,
    item.quotation?.project_name,
    item.customer?.company_name,
    item.purchase_order?.po_number,
    item.salesperson?.full_name,
    item.salesperson?.email,
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
    completionFrom?: string;
    completionTo?: string;
    customerSearch?: string;
    salespersonSearch?: string;
    jobNumber?: string;
    quotationNumber?: string;
    poNumber?: string;
  } = {},
) {
  let query = admin
    .from("jobs")
    .select(
      "id,quotation_series_id,latest_accepted_quotation_id,customer_id,job_number,job_status,accepted_at,salesperson_id,latest_work_completion_id",
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

  const jobIds = jobs.map((job) => job.id);
  const [allocationResult, scopeAssignmentsResult] = await Promise.all([
    jobIds.length ? admin
        .from("job_purchase_order_allocations")
        .select("job_id,purchase_order_id")
        .eq("org_id", orgId)
        .in("job_id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length ? admin
      .from("job_scope_assignments")
      .select("job_id,quotation_id,scope_id,quotation_scopes!inner(scope_title,scope_description,sort_order)")
      .eq("org_id", orgId)
      .in("job_id", jobIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (allocationResult.error || scopeAssignmentsResult.error) {
    return { error: allocationResult.error ?? scopeAssignmentsResult.error, jobs: [] as JobListItem[], total: 0 };
  }
  const allocations = (allocationResult.data ?? []) as Array<{
    job_id: string;
    purchase_order_id: string;
  }>;
  const purchaseOrderIds = Array.from(new Set(allocations.map((row) => row.purchase_order_id)));

  const [quotationResult, customerResult, profileResult, purchaseOrderResult, completionResult] = await Promise.all([
    quotationIds.length
      ? admin
          .from("quotations")
          .select(
            "id,quotation_number,revision_number,project_name,grand_total_after_tax,grand_total_before_tax,tax_name,tax_rate,quote_date,currency",
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
    purchaseOrderIds.length
      ? admin
          .from("job_purchase_orders")
          .select("id,po_number,po_received_date")
          .eq("org_id", orgId)
          .in("id", purchaseOrderIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? admin
          .from("job_work_completions")
          .select("id,job_id,certificate_number,completion_date,completed_at,completion_status")
          .eq("org_id", orgId)
          .eq("generation_status", "generated")
          .in("job_id", jobIds)
          .order("completed_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relatedError =
    quotationResult.error ?? customerResult.error ?? profileResult.error ??
    purchaseOrderResult.error ?? completionResult.error;
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
  const purchaseOrders = new Map(
    (purchaseOrderResult.data ?? []).map((row) => [row.id, row]),
  );
  const allocationByJob = new Map(allocations.map((row) => [row.job_id, row]));
  const scopesByJob = new Map<string, JobListItem["assigned_scopes"]>();
  for (const row of scopeAssignmentsResult.data ?? []) {
    const relation = row.quotation_scopes as unknown as { scope_title: string; scope_description?: string | null; sort_order?: number | null };
    const values = scopesByJob.get(row.job_id) ?? [];
    values.push({ id: row.scope_id, quotation_id: row.quotation_id, ...relation });
    scopesByJob.set(row.job_id, values);
  }
  const completionByJob = new Map<string, CompletionListRow>();
  const completionsById = new Map<string, CompletionListRow>();
  for (const completion of (completionResult.data ?? []) as CompletionListRow[]) {
    completionsById.set(completion.id, completion);
    if (!completionByJob.has(completion.job_id)) completionByJob.set(completion.job_id, completion);
  }

  const includes = (value: unknown, query: string | undefined) =>
    !query?.trim() || String(value ?? "").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());

  const filtered = jobs
    .map((job): JobListItem => {
      const allocation = allocationByJob.get(job.id);
      return {
        ...job,
        quotation: quotations.get(job.latest_accepted_quotation_id) ?? null,
        customer: customers.get(job.customer_id) ?? null,
        salesperson: job.salesperson_id ? (profiles.get(job.salesperson_id) ?? null) : null,
        purchase_order: allocation
          ? (purchaseOrders.get(allocation.purchase_order_id) as JobListItem["purchase_order"] ?? null)
          : null,
        completion: ((job.latest_work_completion_id
          ? completionsById.get(job.latest_work_completion_id)
          : completionByJob.get(job.id)) as JobListItem["completion"]) ?? null,
        assigned_scopes: (scopesByJob.get(job.id) ?? []).sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
      };
    })
    .filter((job) => includesSearch(job, options.search ?? ""))
    .filter((job) => includes(job.customer?.company_name, options.customerSearch))
    .filter((job) => includes(job.salesperson?.full_name ?? job.salesperson?.email, options.salespersonSearch))
    .filter((job) => includes(job.job_number, options.jobNumber))
    .filter((job) => includes(job.quotation?.quotation_number, options.quotationNumber))
    .filter((job) => includes(job.purchase_order?.po_number, options.poNumber))
    .filter((job) => !options.completionFrom || Boolean(job.completion && job.completion.completion_date >= options.completionFrom))
    .filter((job) => !options.completionTo || Boolean(job.completion && job.completion.completion_date <= options.completionTo))
    .sort((left, right) => {
      if (options.status === "work_completed") {
        return String(right.completion?.completed_at ?? "").localeCompare(String(left.completion?.completed_at ?? ""));
      }
      return String(right.accepted_at ?? "").localeCompare(String(left.accepted_at ?? ""));
    });

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
    invoiceRequestResult,
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
      .from("invoice_requests")
      .select("id,request_number,invoice_type,requested_amount,currency,status,created_at")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
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
    invoiceRequestResult.error ??
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

  const [scopeAssignmentsResult, completionsResult] = await Promise.all([
    admin
      .from("job_scope_assignments")
      .select("scope_id,quotation_id,quotation_scopes!inner(scope_title,scope_description,sort_order)")
      .eq("job_id", jobId)
      .eq("org_id", orgId),
    admin
      .from("job_work_completions")
      .select("*")
      .eq("job_id", jobId)
      .eq("org_id", orgId)
      .eq("generation_status", "generated")
      .order("completed_at", { ascending: false }),
  ]);
  if (scopeAssignmentsResult.error || completionsResult.error) {
    return { error: scopeAssignmentsResult.error ?? completionsResult.error, job: null };
  }

  const completions = completionsResult.data ?? [];
  const completionIds = completions.map((completion) => completion.id);
  const [techniciansResult, completionScopesResult] = await Promise.all([
    completionIds.length
      ? admin
          .from("job_work_completion_technicians")
          .select("completion_id,employee_id,employee_name_snapshot,sort_order")
          .eq("org_id", orgId)
          .in("completion_id", completionIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    completionIds.length
      ? admin
          .from("job_work_completion_scopes")
          .select("completion_id,scope_id,scope_title_snapshot,scope_description_snapshot,sort_order")
          .eq("org_id", orgId)
          .in("completion_id", completionIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (techniciansResult.error || completionScopesResult.error) {
    return { error: techniciansResult.error ?? completionScopesResult.error, job: null };
  }

  const employeeIds = Array.from(new Set((techniciansResult.data ?? []).map((row) => row.employee_id)));
  const completionProfileIds = Array.from(new Set(completions.flatMap((completion) =>
    [completion.completed_by, completion.reopened_by].filter(Boolean) as string[],
  )));
  const [employeesResult, completionProfilesResult] = await Promise.all([
    employeeIds.length
      ? admin.from("employee_directory").select("id,employee_name").eq("org_id", orgId).in("id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    completionProfileIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", completionProfileIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (employeesResult.error || completionProfilesResult.error) {
    return { error: employeesResult.error ?? completionProfilesResult.error, job: null };
  }
  const employeeNames = new Map((employeesResult.data ?? []).map((row) => [row.id, row.employee_name]));
  const completionProfiles = new Map((completionProfilesResult.data ?? []).map((row) => [row.id, row]));
  const techniciansByCompletion = new Map<string, Array<Record<string, unknown>>>();
  for (const row of techniciansResult.data ?? []) {
    const values = techniciansByCompletion.get(row.completion_id) ?? [];
    values.push({ ...row, employee_name: employeeNames.get(row.employee_id) ?? row.employee_name_snapshot });
    techniciansByCompletion.set(row.completion_id, values);
  }
  const scopesByCompletion = new Map<string, Array<Record<string, unknown>>>();
  for (const row of completionScopesResult.data ?? []) {
    const values = scopesByCompletion.get(row.completion_id) ?? [];
    values.push(row);
    scopesByCompletion.set(row.completion_id, values);
  }
  const enrichedCompletions = completions.map((completion) => ({
    ...completion,
    technicians: techniciansByCompletion.get(completion.id) ?? [],
    scopes: scopesByCompletion.get(completion.id) ?? [],
    completed_by_profile: completion.completed_by
      ? completionProfiles.get(completion.completed_by) ?? null
      : null,
    reopened_by_profile: completion.reopened_by
      ? completionProfiles.get(completion.reopened_by) ?? null
      : null,
  }));

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
      assigned_scopes: (scopeAssignmentsResult.data ?? []).map((row) => ({
        id: row.scope_id,
        quotation_id: row.quotation_id,
        ...(row.quotation_scopes as unknown as Record<string, unknown>),
      })),
      work_completions: enrichedCompletions,
      completion: enrichedCompletions.find((completion) => completion.id === job.latest_work_completion_id) ?? enrichedCompletions[0] ?? null,
      invoices,
      invoice_requests: invoiceRequestResult.data ?? [],
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
