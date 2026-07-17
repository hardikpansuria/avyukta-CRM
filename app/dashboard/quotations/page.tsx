"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  full_name?: string | null;
  email?: string | null;
};

type Customer = {
  company_name?: string | null;
};

type Quotation = {
  id: string;
  quotation_number?: string | null;
  quote_date?: string | null;
  expiry_date?: string | null;
  project_name?: string | null;
  customer_rfq_number?: string | null;
  status?: string | null;
  grand_total?: number | string | null;
  updated_at?: string | null;
  customer?: Customer | null;
  prepared_by_profile?: Profile | null;
  sales_rep_profile?: Profile | null;
};

const statuses = [
  ["draft", "Draft"],
  ["pending_approval", "Pending Approval"],
  ["sent", "Sent"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["converted_to_work_order", "Converted to Work Order"],
];

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlainDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number | string | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(numberValue);
}

function profileName(profile: Profile | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

export default function QuotationsPage() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (search.trim()) {
      params.set("search", search.trim());
    }

    if (status) {
      params.set("status", status);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [search, status]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuotations() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/org/quotations${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { quotations?: Quotation[]; error?: string }
          | null;

        if (!response.ok) {
          setError(payload?.error ?? "Unable to load quotations.");
          return;
        }

        setQuotations(payload?.quotations ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load quotations.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadQuotations();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [queryString]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Quotations
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Search, filter, and open quotation drafts for this organization.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          href="/dashboard/quotations/new"
        >
          Create Quotation
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Search
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
              placeholder="Quotation number, customer, project, or RFQ"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Status
            </span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Quotation Register
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Quotation Number</th>
                <th className="px-5 py-3 font-semibold">Customer</th>
                <th className="px-5 py-3 font-semibold">Project Name</th>
                <th className="px-5 py-3 font-semibold">Quote Date</th>
                <th className="px-5 py-3 font-semibold">Expiry Date</th>
                <th className="px-5 py-3 font-semibold">Prepared By</th>
                <th className="px-5 py-3 font-semibold">Sales Rep</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Grand Total</th>
                <th className="px-5 py-3 font-semibold">Updated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    colSpan={10}
                  >
                    Loading quotations...
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={10}>
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        No quotations found
                      </p>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Create a draft quotation to start the estimating
                        workflow.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                quotations.map((quotation) => (
                  <tr
                    className="cursor-pointer transition hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                    key={quotation.id}
                    tabIndex={0}
                    onClick={() =>
                      router.push(`/dashboard/quotations/${quotation.id}`)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        router.push(`/dashboard/quotations/${quotation.id}`);
                      }
                    }}
                  >
                    <td className="px-5 py-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                      {quotation.quotation_number ?? "Pending"}
                    </td>
                    <td className="px-5 py-4 font-medium text-zinc-950 dark:text-zinc-50">
                      {quotation.customer?.company_name ?? "-"}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {quotation.project_name ?? "-"}
                      {quotation.customer_rfq_number ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          RFQ {quotation.customer_rfq_number}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatPlainDate(quotation.quote_date)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatPlainDate(quotation.expiry_date)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {profileName(quotation.prepared_by_profile)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {profileName(quotation.sales_rep_profile)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                        {formatStatus(quotation.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {formatCurrency(quotation.grand_total)}
                    </td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatDateTime(quotation.updated_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
