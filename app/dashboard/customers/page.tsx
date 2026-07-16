"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Tag = {
  id: string;
  name: string;
  color: string;
};

type PrimaryContact = {
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile_number?: string | null;
};

type AssignedSalesRep = {
  full_name?: string | null;
  email?: string | null;
};

type Customer = {
  id: string;
  company_name: string;
  legal_company_name: string | null;
  customer_code: string | null;
  industry: string | null;
  customer_status: string;
  primary_contact: PrimaryContact | null;
  assigned_sales_rep: AssignedSalesRep | null;
  tags: Tag[];
  updated_at: string | null;
};

const CUSTOMER_STATUSES = ["prospect", "active", "inactive", "blacklisted"];

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getContactName(contact: PrimaryContact | null) {
  if (!contact) {
    return "-";
  }

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

  return name || "-";
}

function getSalesRepName(profile: AssignedSalesRep | null) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [tagId, setTagId] = useState("");
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

    if (tagId) {
      params.set("tag_id", tagId);
    }

    const value = params.toString();
    return value ? `?${value}` : "";
  }, [search, status, tagId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomers() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/org/customers${queryString}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as {
          customers?: Customer[];
          tags?: Tag[];
          error?: string;
        } | null;

        if (!response.ok) {
          setError(payload?.error ?? "Unable to load customers.");
          return;
        }

        setCustomers(payload?.customers ?? []);
        setTags(payload?.tags ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load customers.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void loadCustomers();
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
            Customers
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Search and manage company profiles for this organization.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          href="/dashboard/customers/new"
        >
          New Customer
        </Link>
      </div>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
          <label className="block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Search
            </span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
              placeholder="Company, legal name, or customer code"
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
              {CUSTOMER_STATUSES.map((customerStatus) => (
                <option key={customerStatus} value={customerStatus}>
                  {formatLabel(customerStatus)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Tag
            </span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300"
              value={tagId}
              onChange={(event) => setTagId(event.target.value)}
            >
              <option value="">All tags</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
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
            Company Profiles
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3 font-semibold">Customer Code</th>
                <th className="px-5 py-3 font-semibold">Company Name</th>
                <th className="px-5 py-3 font-semibold">Industry</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Primary Contact</th>
                <th className="px-5 py-3 font-semibold">Assigned Sales Rep</th>
                <th className="px-5 py-3 font-semibold">Tags</th>
                <th className="px-5 py-3 font-semibold">Updated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400"
                    colSpan={8}
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center" colSpan={8}>
                    <div className="mx-auto max-w-sm">
                      <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                        No customers found
                      </p>
                      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                        Create your first company profile to start building
                        customer history.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr
                    className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
                    key={customer.id}
                  >
                    <td className="px-5 py-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {customer.customer_code ?? "Pending"}
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="font-medium text-zinc-950 transition hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
                        href={`/dashboard/customers/${customer.id}`}
                      >
                        {customer.company_name}
                      </Link>
                      {customer.legal_company_name ? (
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {customer.legal_company_name}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {customer.industry ?? "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full border border-zinc-200 px-2.5 py-1 text-xs font-medium capitalize text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                        {formatLabel(customer.customer_status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {getContactName(customer.primary_contact)}
                    </td>
                    <td className="px-5 py-4 text-zinc-700 dark:text-zinc-300">
                      {getSalesRepName(customer.assigned_sales_rep)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex max-w-xs flex-wrap gap-1.5">
                        {customer.tags.length > 0 ? (
                          customer.tags.map((tag) => (
                            <span
                              className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white"
                              key={tag.id}
                              style={{ backgroundColor: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 dark:text-zinc-400">
                            -
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-zinc-600 dark:text-zinc-400">
                      {formatDate(customer.updated_at)}
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
