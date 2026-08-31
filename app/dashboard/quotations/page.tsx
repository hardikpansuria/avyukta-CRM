"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CircleDollarSignIcon,
  FileTextIcon,
  FilterXIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

import {
  DateText,
  EmptyState,
  formatCurrency,
  formatDateTime,
  formatPlainDate,
  MoneyText,
  PageHeader,
  QuotationStatusBadge,
  quotationStatuses,
  SectionCard,
} from "./quotation-ui";

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

  function openQuotation(quotationId: string) {
    router.push(`/dashboard/quotations/${quotationId}`);
  }

  const hasFilters = Boolean(search.trim() || status);
  const draftCount = quotations.filter(
    (quotation) => quotation.status === "draft",
  ).length;
  const sentCount = quotations.filter(
    (quotation) => quotation.status === "sent",
  ).length;
  const visibleValue = quotations.reduce(
    (sum, quotation) => sum + Number(quotation.grand_total ?? 0),
    0,
  );
  const selectedStatusLabel =
    quotationStatuses.find(([value]) => value === status)?.[1] ??
    "All statuses";

  return (
    <div className="mx-auto max-w-7xl pb-12">
      <PageHeader
        action={
          <Button
            className="h-10 rounded-md px-4 font-semibold"
            nativeButton={false}
            render={<Link href="/dashboard/quotations/new" />}
            size="lg"
          >
            <PlusIcon data-icon="inline-start" />
            Create Quotation
          </Button>
        }
        description="Search, filter, and manage draft and customer-facing quotations."
        title="Quotations"
      />

      <section
        aria-label="Quotation overview"
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <QuotationMetric
          icon={<FileTextIcon />}
          label="Current Results"
          value={String(quotations.length)}
        />
        <QuotationMetric
          icon={<FileTextIcon />}
          label="Draft"
          value={String(draftCount)}
        />
        <QuotationMetric
          icon={<SendIcon />}
          label="Sent"
          value={String(sentCount)}
        />
        <QuotationMetric
          icon={<CircleDollarSignIcon />}
          label="Visible Value"
          value={formatCurrency(visibleValue)}
        />
      </section>

      <SectionCard className="mb-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Search quotations
            </span>
            <div className="relative mt-2">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="h-10 rounded-md border-zinc-300 bg-white pl-10 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="Quotation number, customer, project, RFQ..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Status
            </span>
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
                {quotationStatuses.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button
            className="h-10 rounded-md"
            disabled={!hasFilters}
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
          >
            <FilterXIcon data-icon="inline-start" />
            Clear
          </Button>
        </div>
      </SectionCard>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <SectionCard
        description={
          hasFilters
            ? `${quotations.length} matching quotation${quotations.length === 1 ? "" : "s"}`
            : "Click a row to open quotation details."
        }
        title="Quotation Register"
      >
        {isLoading ? <QuotationTableSkeleton /> : null}

        {!isLoading && quotations.length === 0 ? (
          <EmptyState
            action={
              <Button
                className="rounded-md px-4"
                nativeButton={false}
                render={<Link href="/dashboard/quotations/new" />}
              >
                Create Quotation
              </Button>
            }
            description="Create a draft quotation to start the estimating workflow."
            title="No quotations found"
          />
        ) : null}

        {!isLoading && quotations.length > 0 ? (
          <>
            <div className="hidden md:block">
              <Table className="min-w-[1180px]">
                <TableHeader className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900/80 dark:text-zinc-400">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Quotation Number</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Quote Date</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Prepared By</TableHead>
                    <TableHead>Sales Rep</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotations.map((quotation) => (
                    <TableRow
                      className="cursor-pointer focus-within:bg-zinc-50 hover:bg-zinc-50 dark:focus-within:bg-zinc-900/70 dark:hover:bg-zinc-900/70"
                      key={quotation.id}
                      tabIndex={0}
                      onClick={() => openQuotation(quotation.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          openQuotation(quotation.id);
                        }
                      }}
                    >
                      <TableCell className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                        {quotation.quotation_number ?? "Pending"}
                      </TableCell>
                      <TableCell className="font-medium text-zinc-950 dark:text-zinc-50">
                        {quotation.customer?.company_name ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-56 whitespace-normal text-zinc-700 dark:text-zinc-300">
                        <span className="line-clamp-1">
                          {quotation.project_name ?? "-"}
                        </span>
                        {quotation.customer_rfq_number ? (
                          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                            RFQ {quotation.customer_rfq_number}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <DateText value={quotation.quote_date} />
                      </TableCell>
                      <TableCell>
                        <DateText value={quotation.expiry_date} />
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {profileName(quotation.prepared_by_profile)}
                      </TableCell>
                      <TableCell className="text-zinc-700 dark:text-zinc-300">
                        {profileName(quotation.sales_rep_profile)}
                      </TableCell>
                      <TableCell>
                        <QuotationStatusBadge status={quotation.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium text-zinc-950 dark:text-zinc-50">
                        <MoneyText value={quotation.grand_total} />
                      </TableCell>
                      <TableCell className="text-zinc-600 dark:text-zinc-400">
                        {formatDateTime(quotation.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
              {quotations.map((quotation) => (
                <button
                  className="w-full p-4 text-left transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-400 dark:hover:bg-zinc-900"
                  key={quotation.id}
                  type="button"
                  onClick={() => openQuotation(quotation.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        {quotation.quotation_number ?? "Pending"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {quotation.customer?.company_name ?? "-"}
                      </p>
                    </div>
                    <QuotationStatusBadge status={quotation.status} />
                  </div>
                  <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {quotation.project_name ?? "No project name"}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>Quote {formatPlainDate(quotation.quote_date)}</span>
                    <span>Expires {formatPlainDate(quotation.expiry_date)}</span>
                    <span>{profileName(quotation.sales_rep_profile)}</span>
                    <span className="text-right font-semibold text-zinc-950 dark:text-zinc-50">
                      {formatCurrency(quotation.grand_total)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </SectionCard>
    </div>
  );
}

function QuotationMetric({
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
      <div className="min-w-0">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
          {value}
        </p>
      </div>
    </div>
  );
}

function QuotationTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-[120px_1fr_1fr_110px_110px_1fr_1fr_130px_110px]"
          key={index}
        >
          {Array.from({ length: 9 }).map((__, cellIndex) => (
            <Skeleton className="h-5 rounded-md" key={cellIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}
