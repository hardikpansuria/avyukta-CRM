"use client";

import {
  ArrowLeftIcon,
  BriefcaseBusinessIcon,
  ClipboardPlusIcon,
  SearchIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type UnbilledJob = {
  job_id: string;
  job_number: string | null;
  job_status: "work_in_process" | "work_completed";
  customer_id: string;
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

type Summary = {
  total_jobs: number;
  by_currency: Array<{
    currency: string;
    po_amount: string;
    invoiced_amount: string;
    remaining_unbilled_amount: string;
  }>;
};

type CustomerOption = { id: string; company_name: string };

const statusLabels = {
  all: "All job statuses",
  work_in_process: "Work In Progress",
  work_completed: "Completed",
} as const;

const sortLabels = {
  default: "Completed first · Remaining high to low",
  remaining_desc: "Remaining · High to low",
  remaining_asc: "Remaining · Low to high",
  po_amount_desc: "PO amount · High to low",
  po_amount_asc: "PO amount · Low to high",
  job_number_asc: "Job number · Ascending",
  job_number_desc: "Job number · Descending",
  last_invoice_date_desc: "Last invoice · Newest first",
  last_invoice_date_asc: "Last invoice · Oldest first",
  completion_date_desc: "Completion · Newest first",
  completion_date_asc: "Completion · Oldest first",
} as const;

function money(value: string, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function SummaryValue({
  values,
  field,
}: {
  values: Summary["by_currency"];
  field: "po_amount" | "invoiced_amount" | "remaining_unbilled_amount";
}) {
  if (!values.length) return <span>$0.00</span>;
  return (
    <span className="space-y-1">
      {values.map((value) => (
        <span className="block" key={value.currency}>
          {money(value[field], value.currency)}
        </span>
      ))}
    </span>
  );
}

export default function UnbilledJobsPage() {
  const [jobs, setJobs] = useState<UnbilledJob[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_jobs: 0,
    by_currency: [],
  });
  const [filters, setFilters] = useState({
    job: "",
    po: "",
    customer: "",
    customerId: "",
    status: "",
    sort: "default",
  });
  const [debounced, setDebounced] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canCreateRequest, setCanCreateRequest] = useState(false);
  const [canViewJobs, setCanViewJobs] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(filters), 300);
    return () => window.clearTimeout(timeout);
  }, [filters]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(debounced)) {
      if (!value || (key === "sort" && value === "default")) continue;
      if (key === "sort") {
        const separator = value.lastIndexOf("_");
        params.set("sort", value.slice(0, separator));
        params.set("direction", value.slice(separator + 1));
      } else {
        params.set(key, value);
      }
    }
    return params.toString();
  }, [debounced]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/org/job-invoices/unbilled${query ? `?${query}` : ""}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              jobs?: UnbilledJob[];
              customers?: CustomerOption[];
              summary?: Summary;
              permissions?: {
                can_create_request?: boolean;
                can_view_jobs?: boolean;
              };
              error?: string;
            }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load unbilled jobs.");
          return;
        }
        setJobs(payload?.jobs ?? []);
        setCustomers(payload?.customers ?? []);
        setSummary(
          payload?.summary ?? { total_jobs: 0, by_currency: [] },
        );
        setCanCreateRequest(
          payload?.permissions?.can_create_request === true,
        );
        setCanViewJobs(payload?.permissions?.can_view_jobs === true);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load unbilled jobs.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  const update = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <Button
            className="-ml-3 mb-2"
            nativeButton={false}
            render={<Link href="/dashboard/invoices" />}
            variant="ghost"
          >
            <ArrowLeftIcon />
            Back to Invoices
          </Button>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <WalletCardsIcon className="size-4" />
            Accounts Receivable
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Unbilled Jobs</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Work in progress and completed jobs that still have a positive PO
            balance available for invoicing.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<BriefcaseBusinessIcon className="size-5" />}
          label="Total Unbilled Jobs"
          value={String(summary.total_jobs)}
        />
        <SummaryCard
          label="Total PO / Billable Value"
          value={<SummaryValue field="po_amount" values={summary.by_currency} />}
        />
        <SummaryCard
          label="Total Already Invoiced"
          value={
            <SummaryValue field="invoiced_amount" values={summary.by_currency} />
          }
        />
        <SummaryCard
          prominent
          label="Total Remaining Unbilled"
          value={
            <SummaryValue
              field="remaining_unbilled_amount"
              values={summary.by_currency}
            />
          }
        />
      </div>

      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["job", "Search Job Number"],
            ["po", "Search PO Number"],
            ["customer", "Search Customer Name"],
          ].map(([key, placeholder]) => (
            <label className="relative" key={key}>
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <Input
                className="pl-9"
                placeholder={placeholder}
                value={filters[key as keyof typeof filters]}
                onChange={(event) =>
                  update(key as keyof typeof filters, event.target.value)
                }
              />
            </label>
          ))}
          <Select
            value={filters.status || "all"}
            onValueChange={(value) =>
              update("status", value === "all" ? "" : String(value))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {
                  statusLabels[
                    (filters.status || "all") as keyof typeof statusLabels
                  ]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All job statuses</SelectItem>
              <SelectItem value="work_in_process">Work In Progress</SelectItem>
              <SelectItem value="work_completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.customerId || "all"}
            onValueChange={(value) =>
              update("customerId", value === "all" ? "" : String(value))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {filters.customerId
                  ? customers.find(
                      (customer) => customer.id === filters.customerId,
                    )?.company_name
                  : "All customers"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.sort}
            onValueChange={(value) => update("sort", String(value))}
          >
            <SelectTrigger className="w-full sm:col-span-2 xl:col-span-3">
              <SelectValue>
                {sortLabels[filters.sort as keyof typeof sortLabels]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(sortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-2xl border border-red-200 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : null}
      {!loading && !jobs.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <WalletCardsIcon className="mx-auto size-10 text-emerald-600" />
            <h2 className="mt-4 text-lg font-semibold">No unbilled jobs found</h2>
            <p className="mt-1 text-sm text-zinc-500">
              All eligible jobs are fully invoiced or do not match the selected
              filters.
            </p>
          </CardContent>
        </Card>
      ) : null}
      {!loading && jobs.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Jobs requiring billing attention</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job / PO</TableHead>
                  <TableHead>Customer / Project</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>PO Amount</TableHead>
                  <TableHead>Already Invoiced</TableHead>
                  <TableHead>Remaining Unbilled</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Invoice</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const percentage = Math.min(
                    100,
                    Math.max(0, Number(job.percentage_invoiced)),
                  );
                  const hasAvailableRequestBalance =
                    Number(job.available_to_request_amount) > 0;
                  return (
                    <TableRow key={job.job_id}>
                      <TableCell>
                        <p className="font-semibold">{job.job_number ?? "-"}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          PO No: {job.po_number}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-64 whitespace-normal">
                        <p className="font-medium">{job.customer_name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          Project Name: {job.project_name || "No project description"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            job.job_status === "work_completed"
                              ? "default"
                              : "outline"
                          }
                        >
                          {statusLabels[job.job_status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{money(job.po_amount, job.currency)}</TableCell>
                      <TableCell>
                        {money(job.invoiced_amount, job.currency)}
                      </TableCell>
                      <TableCell>
                        <p className="text-base font-bold text-amber-700 dark:text-amber-400">
                          {money(job.remaining_unbilled_amount, job.currency)}
                        </p>
                        {Number(job.pending_request_amount) > 0 ? (
                          <p className="mt-1 text-xs text-zinc-500">
                            {money(job.pending_request_amount, job.currency)} in
                            active requests
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-36">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span>{job.percentage_invoiced}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                          <div
                            aria-label={`${job.percentage_invoiced}% invoiced`}
                            className="h-full rounded-full bg-emerald-600"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(job.last_invoice_date)}</TableCell>
                      <TableCell>{formatDate(job.completion_date)}</TableCell>
                      <TableCell>{job.salesperson_name || "-"}</TableCell>
                      <TableCell>
                        <div className="flex min-w-44 flex-col gap-2">
                          {canCreateRequest && hasAvailableRequestBalance ? (
                            <Button
                              nativeButton={false}
                              render={
                                <Link
                                  href={`/dashboard/invoice-requests/new?jobId=${job.job_id}`}
                                />
                              }
                              size="sm"
                            >
                              <ClipboardPlusIcon />
                              Create Invoice Request
                            </Button>
                          ) : canCreateRequest ? (
                            <Badge className="justify-center" variant="outline">
                              Balance reserved by active request
                            </Badge>
                          ) : null}
                          {canViewJobs ? (
                            <>
                              <Button
                                nativeButton={false}
                                render={
                                  <Link href={`/dashboard/jobs/${job.job_id}`} />
                                }
                                size="sm"
                                variant="outline"
                              >
                                View Job
                              </Button>
                              <Button
                                nativeButton={false}
                                render={
                                  <Link
                                    href={`/dashboard/jobs/${job.job_id}#invoices`}
                                  />
                                }
                                size="sm"
                                variant="ghost"
                              >
                                Invoice History
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  prominent = false,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  prominent?: boolean;
  value: React.ReactNode;
}) {
  return (
    <Card className={prominent ? "ring-2 ring-amber-400/70" : undefined}>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          {icon}
          {label}
        </div>
        <div
          className={`mt-3 text-2xl font-semibold ${
            prominent ? "text-amber-700 dark:text-amber-400" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
