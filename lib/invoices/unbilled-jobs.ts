import type { SupabaseClient } from "@supabase/supabase-js";

import { centsToMoney, moneyToCents } from "./exact-money";

export type UnbilledJobStatus = "work_in_process" | "work_completed";

export type UnbilledJob = {
  org_id: string;
  job_id: string;
  job_number: string | null;
  job_status: UnbilledJobStatus;
  customer_id: string;
  salesperson_id: string | null;
  quotation_id: string;
  purchase_order_id: string;
  po_number: string;
  currency: string;
  customer_name: string;
  project_name: string | null;
  salesperson_name: string | null;
  completion_date: string | null;
  last_invoice_date: string | null;
  po_amount: string;
  invoiced_amount: string;
  remaining_unbilled_amount: string;
  pending_request_amount: string;
  available_to_request_amount: string;
  percentage_invoiced: string;
};

export type UnbilledSort =
  | "default"
  | "remaining"
  | "po_amount"
  | "job_number"
  | "last_invoice_date"
  | "completion_date";

export type UnbilledFilters = {
  job?: string;
  po?: string;
  customer?: string;
  customerId?: string;
  status?: UnbilledJobStatus | "";
  sort?: UnbilledSort;
  direction?: "asc" | "desc";
};

function includes(value: unknown, search: string | undefined) {
  return (
    !search?.trim() ||
    String(value ?? "")
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase())
  );
}

function compareNullableDate(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc",
) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return direction === "asc"
    ? left.localeCompare(right)
    : right.localeCompare(left);
}

function compareMoney(
  left: string,
  right: string,
  direction: "asc" | "desc",
) {
  const leftCents = moneyToCents(left);
  const rightCents = moneyToCents(right);
  if (leftCents === rightCents) return 0;
  const ascending = leftCents < rightCents ? -1 : 1;
  return direction === "asc" ? ascending : -ascending;
}

function sortJobs(jobs: UnbilledJob[], filters: UnbilledFilters) {
  const sort = filters.sort ?? "default";
  const direction = filters.direction ?? "desc";
  return jobs.toSorted((left, right) => {
    let compared = 0;
    if (sort === "default") {
      compared =
        Number(right.job_status === "work_completed") -
        Number(left.job_status === "work_completed");
      if (!compared) {
        compared = compareMoney(
          left.remaining_unbilled_amount,
          right.remaining_unbilled_amount,
          "desc",
        );
      }
    } else if (sort === "remaining") {
      compared = compareMoney(
        left.remaining_unbilled_amount,
        right.remaining_unbilled_amount,
        direction,
      );
    } else if (sort === "po_amount") {
      compared = compareMoney(left.po_amount, right.po_amount, direction);
    } else if (sort === "job_number") {
      compared =
        direction === "asc"
          ? String(left.job_number ?? "").localeCompare(
              String(right.job_number ?? ""),
              undefined,
              { numeric: true },
            )
          : String(right.job_number ?? "").localeCompare(
              String(left.job_number ?? ""),
              undefined,
              { numeric: true },
            );
    } else if (sort === "last_invoice_date") {
      compared = compareNullableDate(
        left.last_invoice_date,
        right.last_invoice_date,
        direction,
      );
    } else if (sort === "completion_date") {
      compared = compareNullableDate(
        left.completion_date,
        right.completion_date,
        direction,
      );
    }

    return (
      compared ||
      String(left.job_number ?? left.job_id).localeCompare(
        String(right.job_number ?? right.job_id),
        undefined,
        { numeric: true },
      )
    );
  });
}

function summarize(jobs: UnbilledJob[]) {
  const byCurrency = new Map<
    string,
    { po: bigint; invoiced: bigint; remaining: bigint }
  >();
  for (const job of jobs) {
    const current = byCurrency.get(job.currency) ?? {
      po: BigInt(0),
      invoiced: BigInt(0),
      remaining: BigInt(0),
    };
    current.po += moneyToCents(job.po_amount);
    current.invoiced += moneyToCents(job.invoiced_amount);
    current.remaining += moneyToCents(job.remaining_unbilled_amount);
    byCurrency.set(job.currency, current);
  }

  return {
    total_jobs: jobs.length,
    by_currency: Array.from(byCurrency, ([currency, totals]) => ({
      currency,
      po_amount: centsToMoney(totals.po),
      invoiced_amount: centsToMoney(totals.invoiced),
      remaining_unbilled_amount: centsToMoney(totals.remaining),
    })).sort((left, right) => left.currency.localeCompare(right.currency)),
  };
}

export async function listUnbilledJobs(
  admin: SupabaseClient,
  orgId: string,
  filters: UnbilledFilters = {},
) {
  const { data, error } = await admin
    .from("unbilled_job_balances")
    .select("*")
    .eq("org_id", orgId);
  if (error) return { error };

  const balances = (data ?? []) as UnbilledJob[];
  const anomalies = balances.filter(
    (job) => moneyToCents(job.remaining_unbilled_amount) < BigInt(0),
  );
  const eligible = balances.filter(
    (job) => moneyToCents(job.remaining_unbilled_amount) > BigInt(0),
  );
  const customers = Array.from(
    new Map(
      eligible.map((job) => [
        job.customer_id,
        { id: job.customer_id, company_name: job.customer_name },
      ]),
    ).values(),
  ).sort((left, right) => left.company_name.localeCompare(right.company_name));

  const filtered = eligible
    .filter((job) => includes(job.job_number, filters.job))
    .filter((job) => includes(job.po_number, filters.po))
    .filter((job) => includes(job.customer_name, filters.customer))
    .filter((job) => !filters.customerId || job.customer_id === filters.customerId)
    .filter((job) => !filters.status || job.job_status === filters.status);
  const jobs = sortJobs(filtered, filters);

  return {
    error: null,
    jobs,
    customers,
    summary: summarize(jobs),
    anomaly_job_ids: anomalies.map((job) => job.job_id),
  };
}

export async function countUnbilledJobs(
  admin: SupabaseClient,
  orgId: string,
) {
  const { data, error } = await admin
    .from("unbilled_job_balances")
    .select("remaining_unbilled_amount")
    .eq("org_id", orgId);
  if (error) return { error, count: null };

  return {
    error: null,
    count: (data ?? []).filter(
      (row) => moneyToCents(row.remaining_unbilled_amount) > BigInt(0),
    ).length,
  };
}
