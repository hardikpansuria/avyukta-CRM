"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FilePlus2Icon,
  Layers3Icon,
  SearchIcon,
  WorkflowIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobListItem } from "@/lib/jobs/types";

import { JobStatusTabs } from "../job-status-tabs";

type PageResult = {
  jobs?: JobListItem[];
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

function money(value: number | string | null | undefined, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

function plainDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function salespersonName(job: JobListItem) {
  return job.salesperson?.full_name || job.salesperson?.email || "-";
}

function quotationTotal(job: JobListItem) {
  return (
    job.quotation?.grand_total_after_tax ??
    job.quotation?.grand_total_before_tax ??
    0
  );
}

export default function PoPendingPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PageResult["pagination"]>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "20",
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    return params.toString();
  }, [debouncedSearch, page]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/org/jobs/po-pending?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | PageResult
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load PO pending jobs.");
          return;
        }
        setJobs(payload?.jobs ?? []);
        setPagination(payload?.pagination);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load PO pending jobs.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <WorkflowIcon className="size-4" />
            Job on the Go
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            PO Pending
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Accepted quotations waiting for a customer purchase order.
          </p>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/dashboard/jobs/po-pending/combine" />}
        >
          <Layers3Icon />
          Combine PO
        </Button>
      </div>

      <JobStatusTabs active="po_pending" />

      <Card>
        <CardContent className="space-y-4">
          <label className="relative block max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              placeholder="Search quotation, customer, or project"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton className="h-14 w-full" key={index} />
              ))}
            </div>
          ) : null}

          {!loading && !jobs.length ? (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
              <FilePlus2Icon className="size-8 text-zinc-400" />
              <h2 className="mt-3 font-medium">No PO pending jobs</h2>
              <p className="mt-1 max-w-md text-sm text-zinc-500">
                Jobs appear here automatically when a sent quotation is
                accepted.
              </p>
            </div>
          ) : null}

          {!loading && jobs.length ? (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quotation</TableHead>
                      <TableHead>Revision</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Grand Total</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Salesperson</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.quotation?.quotation_number ?? "-"}
                        </TableCell>
                        <TableCell>
                          {job.quotation?.revision_number ?? 0}
                        </TableCell>
                        <TableCell>
                          {job.customer?.company_name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {job.quotation?.project_name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {money(
                            quotationTotal(job),
                            job.customer?.currency ?? "CAD",
                          )}
                        </TableCell>
                        <TableCell>{plainDate(job.accepted_at)}</TableCell>
                        <TableCell>{salespersonName(job)}</TableCell>
                        <TableCell>
                          <Badge
                            className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                            variant="outline"
                          >
                            PO Pending
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            nativeButton={false}
                            render={
                              <Link
                                href={`/dashboard/jobs/po-pending/${job.id}/attach`}
                              />
                            }
                            size="sm"
                            variant="outline"
                          >
                            Attach PO
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid gap-3 md:hidden">
                {jobs.map((job) => (
                  <Card key={job.id}>
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {job.quotation?.quotation_number ?? "-"} · Rev{" "}
                            {job.quotation?.revision_number ?? 0}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {job.customer?.company_name ?? "-"}
                          </p>
                        </div>
                        <Badge variant="outline">PO Pending</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <dt className="text-zinc-500">Project</dt>
                          <dd>{job.quotation?.project_name ?? "-"}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Total</dt>
                          <dd>
                            {money(
                              quotationTotal(job),
                              job.customer?.currency ?? "CAD",
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Accepted</dt>
                          <dd>{plainDate(job.accepted_at)}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">Salesperson</dt>
                          <dd>{salespersonName(job)}</dd>
                        </div>
                      </dl>
                      <Button
                        className="w-full"
                        nativeButton={false}
                        render={
                          <Link
                            href={`/dashboard/jobs/po-pending/${job.id}/attach`}
                          />
                        }
                        variant="outline"
                      >
                        Attach PO
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}

          {pagination && pagination.totalPages > 1 ? (
            <div className="flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-zinc-500">
                {pagination.total} job{pagination.total === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  disabled={page <= 1}
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  disabled={page >= pagination.totalPages}
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
