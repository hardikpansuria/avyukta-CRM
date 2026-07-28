import type { SupabaseClient } from "@supabase/supabase-js";

export type OutstandingInvoiceRow = {
  invoice_id: string;
  org_id: string;
  purchase_order_id: string;
  po_number?: string | null;
  job_id: string;
  job_number?: string | null;
  customer_id: string;
  quotation_number?: string | null;
  revision_number?: number | string | null;
  project_name?: string | null;
  invoice_number: string;
  invoice_date: string;
  invoice_amount: number | string;
  status: string;
  sent_at: string;
  days_outstanding: number | string;
  outstanding_balance: number | string;
};

export type OutstandingCustomerGroup = {
  customer_id: string;
  customer_name: string;
  currency: string;
  total_outstanding: number;
  invoices: Array<
    OutstandingInvoiceRow & {
      customer_name: string;
      currency: string;
      aging_bucket: string;
    }
  >;
};

function agingBucket(daysValue: number | string) {
  const days = Number(daysValue ?? 0);
  if (days <= 0) return "Current / Not Sent";
  if (days <= 30) return "1–30 days";
  if (days <= 60) return "31–60 days";
  if (days <= 90) return "61–90 days";
  return "91+ days";
}

export async function getOutstandingReceivables(
  admin: SupabaseClient,
  orgId: string,
) {
  const { data: rows, error } = await admin
    .from("job_outstanding_invoices")
    .select("*")
    .eq("org_id", orgId)
    .order("days_outstanding", { ascending: false });
  if (error) return { error };
  const invoices = (rows ?? []) as OutstandingInvoiceRow[];
  const customerIds = Array.from(
    new Set(invoices.map((invoice) => invoice.customer_id)),
  );
  const { data: customers, error: customersError } = customerIds.length
    ? await admin
        .from("customers")
        .select("id,company_name,currency")
        .eq("org_id", orgId)
        .in("id", customerIds)
    : { data: [], error: null };
  if (customersError) return { error: customersError };
  const customerMap = new Map(
    (customers ?? []).map((customer) => [customer.id, customer]),
  );
  const groupMap = new Map<string, OutstandingCustomerGroup>();
  invoices.forEach((invoice) => {
    const customer = customerMap.get(invoice.customer_id);
    const enriched = {
      ...invoice,
      customer_name: customer?.company_name ?? "Unknown Customer",
      currency: customer?.currency ?? "CAD",
      aging_bucket: agingBucket(invoice.days_outstanding),
    };
    const existing: OutstandingCustomerGroup =
      groupMap.get(invoice.customer_id) ?? {
        customer_id: invoice.customer_id,
        customer_name: enriched.customer_name,
        currency: enriched.currency,
        total_outstanding: 0,
        invoices: [],
      };
    existing.invoices.push(enriched);
    existing.total_outstanding += Number(invoice.outstanding_balance ?? 0);
    groupMap.set(invoice.customer_id, existing);
  });
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    a.customer_name.localeCompare(b.customer_name),
  );
  return {
    error: null,
    groups,
    grand_total: groups.reduce(
      (sum, group) => sum + group.total_outstanding,
      0,
    ),
    invoice_count: invoices.length,
  };
}
