"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRightIcon,
  ContactIcon,
  FilterXIcon,
  PlusIcon,
  SearchIcon,
  TagsIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "../quotations/quotation-ui";

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

const customerStatuses = [
  ["prospect", "Prospect"],
  ["active", "Active"],
  ["inactive", "Inactive"],
  ["blacklisted", "Blacklisted"],
];

const statusClasses: Record<string, string> = {
  prospect:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  inactive:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  blacklisted:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
};

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

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
  }).format(date);
}

function getContactName(contact: PrimaryContact | null) {
  if (!contact) {
    return "-";
  }

  return (
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "-"
  );
}

function getSalesRepName(profile: AssignedSalesRep | null) {
  if (!profile) {
    return "Unassigned";
  }

  return profile.full_name || profile.email || "Unassigned";
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

  const hasFilters = Boolean(search.trim() || status || tagId);
  const activeCount = customers.filter(
    (customer) => customer.customer_status === "active",
  ).length;
  const prospectCount = customers.filter(
    (customer) => customer.customer_status === "prospect",
  ).length;
  const contactCount = customers.filter(
    (customer) => customer.primary_contact,
  ).length;
  const selectedStatusLabel =
    customerStatuses.find(([value]) => value === status)?.[1] ??
    "All statuses";
  const selectedTagLabel =
    tags.find((tag) => tag.id === tagId)?.name ?? "All tags";

  function clearFilters() {
    setSearch("");
    setStatus("");
    setTagId("");
  }

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <PageHeader
        action={
          <Button
            className="h-10 rounded-md px-4 font-semibold"
            nativeButton={false}
            render={<Link href="/dashboard/customers/new" />}
          >
            <PlusIcon data-icon="inline-start" />
            New Customer
          </Button>
        }
        description="Manage customer companies, contacts, ownership, and account status."
        title="Customers"
      />

      <section
        aria-label="Customer overview"
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <CustomerMetric
          icon={<UsersIcon />}
          label="Current Results"
          value={String(customers.length)}
        />
        <CustomerMetric
          icon={<UserCheckIcon />}
          label="Active"
          value={String(activeCount)}
        />
        <CustomerMetric
          icon={<ContactIcon />}
          label="Prospects"
          value={String(prospectCount)}
        />
        <CustomerMetric
          icon={<TagsIcon />}
          label="With Primary Contact"
          value={String(contactCount)}
        />
      </section>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="min-w-0 flex-1">
            <Label
              className="text-xs font-medium text-zinc-600 dark:text-zinc-300"
              htmlFor="customer-search"
            >
              Search customers
            </Label>
            <div className="relative mt-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="h-10 rounded-md border-zinc-300 bg-white pl-10 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                id="customer-search"
                placeholder="Company, legal name, or customer code..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:w-[460px]">
            <div>
              <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Status
              </Label>
              <Select
                value={status || "all"}
                onValueChange={(value) =>
                  setStatus(value === "all" ? "" : String(value ?? ""))
                }
              >
                <SelectTrigger className="mt-2 h-10 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <SelectValue>{selectedStatusLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All statuses</SelectItem>
                  {customerStatuses.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                Tag
              </Label>
              <Select
                value={tagId || "all"}
                onValueChange={(value) =>
                  setTagId(value === "all" ? "" : String(value ?? ""))
                }
              >
                <SelectTrigger className="mt-2 h-10 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                  <SelectValue>{selectedTagLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="all">All tags</SelectItem>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="h-10 rounded-md xl:w-auto"
            disabled={!hasFilters}
            type="button"
            variant="outline"
            onClick={clearFilters}
          >
            <FilterXIcon data-icon="inline-start" />
            Clear
          </Button>
        </div>
      </section>

      {error ? (
        <div
          className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              Customer Register
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {hasFilters
                ? `${customers.length} matching customer${customers.length === 1 ? "" : "s"}`
                : "All customer companies in this workspace"}
            </p>
          </div>
        </div>

        {isLoading ? (
          <CustomerSkeleton />
        ) : customers.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <UsersIcon className="size-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              No customers found
            </p>
            <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              {hasFilters
                ? "Adjust the filters to broaden your results."
                : "Create your first customer company to begin building account history."}
            </p>
            {hasFilters ? (
              <Button
                className="mt-4 h-8 rounded-md"
                size="sm"
                type="button"
                variant="outline"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                className="mt-4 h-8 rounded-md"
                nativeButton={false}
                render={<Link href="/dashboard/customers/new" />}
                size="sm"
              >
                Add Customer
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table className="min-w-[1120px]">
                <TableHeader className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900/70 dark:text-zinc-400">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Customer</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary Contact</TableHead>
                    <TableHead>Sales Representative</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <Link
                          className="font-medium text-zinc-950 hover:underline dark:text-zinc-50"
                          href={`/dashboard/customers/${customer.id}`}
                        >
                          {customer.company_name}
                        </Link>
                        {customer.legal_company_name ? (
                          <p className="mt-1 max-w-56 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {customer.legal_company_name}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {customer.customer_code ?? "Pending"}
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {customer.industry ?? "-"}
                      </TableCell>
                      <TableCell>
                        <CustomerStatusBadge
                          status={customer.customer_status}
                        />
                      </TableCell>
                      <TableCell>
                        <p className="text-zinc-700 dark:text-zinc-300">
                          {getContactName(customer.primary_contact)}
                        </p>
                        {customer.primary_contact?.email ? (
                          <p className="mt-1 max-w-48 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {customer.primary_contact.email}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {getSalesRepName(customer.assigned_sales_rep)}
                      </TableCell>
                      <TableCell>
                        <CustomerTags tags={customer.tags} />
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400">
                        {formatDate(customer.updated_at)}
                      </TableCell>
                      <TableCell>
                        <Link
                          aria-label={`Open ${customer.company_name}`}
                          className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                          href={`/dashboard/customers/${customer.id}`}
                        >
                          <ArrowUpRightIcon className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
              {customers.map((customer) => (
                <Link
                  className="block p-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                  href={`/dashboard/customers/${customer.id}`}
                  key={customer.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-zinc-950 dark:text-zinc-50">
                        {customer.company_name}
                      </p>
                      <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {customer.customer_code ?? "Pending"}
                      </p>
                    </div>
                    <CustomerStatusBadge status={customer.customer_status} />
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <MobileDetail
                      label="Primary Contact"
                      value={getContactName(customer.primary_contact)}
                    />
                    <MobileDetail
                      label="Sales Representative"
                      value={getSalesRepName(customer.assigned_sales_rep)}
                    />
                    <MobileDetail
                      label="Industry"
                      value={customer.industry ?? "-"}
                    />
                    <MobileDetail
                      label="Updated"
                      value={formatDate(customer.updated_at)}
                    />
                  </div>
                  {customer.tags.length > 0 ? (
                    <div className="mt-4">
                      <CustomerTags tags={customer.tags} />
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function CustomerMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-600 [&_svg]:size-4 dark:bg-zinc-900 dark:text-zinc-300">
        {icon}
      </div>
      <div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {value}
        </p>
      </div>
    </div>
  );
}

function CustomerStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={`h-6 rounded-full border px-2.5 shadow-none ${
        statusClasses[status] ??
        "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
      }`}
      variant="outline"
    >
      {formatLabel(status)}
    </Badge>
  );
}

function CustomerTags({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return <span className="text-zinc-500 dark:text-zinc-400">-</span>;
  }

  return (
    <div className="flex max-w-xs flex-wrap gap-1.5">
      {tags.slice(0, 3).map((tag) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
          key={tag.id}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: tag.color }}
          />
          {tag.name}
        </span>
      ))}
      {tags.length > 3 ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          +{tags.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{value}</p>
    </div>
  );
}

function CustomerSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="grid gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-[1.4fr_100px_1fr_100px_1.2fr_1.2fr_1fr_100px]"
          key={index}
        >
          {Array.from({ length: 8 }).map((__, cellIndex) => (
            <Skeleton className="h-5 rounded-md" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
