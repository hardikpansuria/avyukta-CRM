export type JobStatus = "po_pending" | "work_in_process" | "work_completed";

export type ProfileSummary = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

export type CustomerSummary = {
  id: string;
  company_name: string;
  currency?: string | null;
};

export type QuotationSummary = {
  id: string;
  quotation_number?: string | null;
  revision_number?: number | string | null;
  project_name?: string | null;
  grand_total_after_tax?: number | string | null;
  grand_total_before_tax?: number | string | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
  quote_date?: string | null;
  currency?: string | null;
};

export type JobListItem = {
  id: string;
  quotation_series_id: string;
  latest_accepted_quotation_id: string;
  customer_id: string;
  job_number?: string | null;
  job_status: JobStatus;
  accepted_at?: string | null;
  salesperson_id?: string | null;
  quotation: QuotationSummary | null;
  customer: CustomerSummary | null;
  salesperson: ProfileSummary | null;
  purchase_order: {
    id: string;
    po_number: string;
    po_received_date: string;
  } | null;
  completion: {
    id: string;
    certificate_number: string;
    completion_date: string;
    completed_at: string;
    completion_status: "completed" | "completed_with_outstanding_items";
  } | null;
  assigned_scopes: Array<{
    id: string;
    quotation_id: string;
    scope_title: string;
    scope_description?: string | null;
    sort_order?: number | null;
  }>;
};
