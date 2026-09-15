"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDownAZIcon, ArrowUpAZIcon, CalendarArrowDownIcon, CalendarArrowUpIcon, ListFilterIcon, WorkflowIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { JobListItem } from "@/lib/jobs/types";

import { JobStatusTabs } from "../job-status-tabs";

type Filters = { completionFrom: string; completionTo: string; customer: string; salesperson: string; jobNumber: string; quotationNumber: string; poNumber: string };
type SortValue = "completion_date:desc" | "completion_date:asc" | "company_name:asc" | "company_name:desc" | "job_number:asc" | "job_number:desc";
const emptyFilters: Filters = { completionFrom: "", completionTo: "", customer: "", salesperson: "", jobNumber: "", quotationNumber: "", poNumber: "" };
const sortLabels: Record<SortValue, string> = {
  "completion_date:desc": "Completion date: newest",
  "completion_date:asc": "Completion date: oldest",
  "company_name:asc": "Company name: A–Z",
  "company_name:desc": "Company name: Z–A",
  "job_number:asc": "Job number: ascending",
  "job_number:desc": "Job number: descending",
};

function date(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

export default function JobCompletedPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortValue, setSortValue] = useState<SortValue>("completion_date:desc");

  const query = useMemo(() => {
    const params = new URLSearchParams({ status: "work_completed", page: String(page), pageSize: "20" });
    const [sort, direction] = sortValue.split(":");
    params.set("sort", sort);
    params.set("direction", direction);
    Object.entries(applied).forEach(([key, value]) => {
      if (!value) return;
      const names: Record<string, string> = { completionFrom: "completion_from", completionTo: "completion_to", jobNumber: "job_number", quotationNumber: "quotation_number", poNumber: "po_number" };
      params.set(names[key] ?? key, value);
    });
    return params.toString();
  }, [applied, page, sortValue]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/org/jobs?${query}`, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { jobs?: JobListItem[]; pagination?: { totalPages: number }; error?: string } | null;
        if (!response.ok) setError(payload?.error ?? "Unable to load completed jobs.");
        else { setJobs(payload?.jobs ?? []); setTotalPages(payload?.pagination?.totalPages ?? 1); }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError("Unable to load completed jobs.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  function update(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-sm text-zinc-500"><WorkflowIcon className="size-4" />Job on the Go</div><h1 className="mt-1 text-2xl font-semibold">Job Completed</h1><p className="mt-1 text-sm text-zinc-500">Completed purchase-order jobs.</p></div><DropdownMenu><DropdownMenuTrigger render={<Button variant="outline" />}><ListFilterIcon /> Sort by: {sortLabels[sortValue]}</DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-64"><DropdownMenuLabel>Sort completed jobs</DropdownMenuLabel><DropdownMenuRadioGroup value={sortValue} onValueChange={(value) => { setSortValue(value as SortValue); setPage(1); }}><DropdownMenuRadioItem value="completion_date:desc"><CalendarArrowDownIcon /> Completion date: newest</DropdownMenuRadioItem><DropdownMenuRadioItem value="completion_date:asc"><CalendarArrowUpIcon /> Completion date: oldest</DropdownMenuRadioItem><DropdownMenuRadioItem value="company_name:asc"><ArrowDownAZIcon /> Company name: A–Z</DropdownMenuRadioItem><DropdownMenuRadioItem value="company_name:desc"><ArrowUpAZIcon /> Company name: Z–A</DropdownMenuRadioItem><DropdownMenuRadioItem value="job_number:asc">Job number: ascending</DropdownMenuRadioItem><DropdownMenuRadioItem value="job_number:desc">Job number: descending</DropdownMenuRadioItem></DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu></div>
    <JobStatusTabs active="po_completed" />
    <Card><CardContent className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label>Completion From</Label><Input type="date" value={filters.completionFrom} onChange={(event) => update("completionFrom", event.target.value)} /></div>
        <div className="space-y-1"><Label>Completion To</Label><Input type="date" value={filters.completionTo} onChange={(event) => update("completionTo", event.target.value)} /></div>
        <div className="space-y-1"><Label>Customer</Label><Input value={filters.customer} onChange={(event) => update("customer", event.target.value)} /></div>
        <div className="space-y-1"><Label>Sales Representative</Label><Input value={filters.salesperson} onChange={(event) => update("salesperson", event.target.value)} /></div>
        <div className="space-y-1"><Label>Job Number</Label><Input value={filters.jobNumber} onChange={(event) => update("jobNumber", event.target.value)} /></div>
        <div className="space-y-1"><Label>Quotation Number</Label><Input value={filters.quotationNumber} onChange={(event) => update("quotationNumber", event.target.value)} /></div>
        <div className="space-y-1"><Label>PO Number</Label><Input value={filters.poNumber} onChange={(event) => update("poNumber", event.target.value)} /></div>
        <div className="flex items-end gap-2"><Button onClick={() => { setPage(1); setApplied(filters); }}>Apply Filters</Button><Button variant="outline" onClick={() => { setFilters(emptyFilters); setApplied(emptyFilters); setPage(1); }}>Clear</Button></div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-14" key={index} />)}</div> : null}
      {!loading && !jobs.length ? <div className="min-h-52 rounded-lg border border-dashed p-10 text-center text-sm text-zinc-500">No completed jobs match these filters.</div> : null}
      {!loading && jobs.length ? <Table><TableHeader><TableRow><TableHead>Job #</TableHead><TableHead>Customer</TableHead><TableHead>PO #</TableHead><TableHead>Project</TableHead><TableHead>Sales Rep</TableHead><TableHead>Status</TableHead><TableHead>Completion Date</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell><Link className="font-medium hover:underline" href={`/dashboard/jobs/${job.id}`}>{job.job_number ?? "-"}</Link></TableCell><TableCell>{job.customer?.company_name ?? "-"}</TableCell><TableCell>{job.purchase_order?.po_number ?? "-"}</TableCell><TableCell>{job.quotation?.project_name ?? "-"}</TableCell><TableCell>{job.salesperson?.full_name || job.salesperson?.email || "-"}</TableCell><TableCell><Badge variant="outline">Work Completed</Badge></TableCell><TableCell>{date(job.completion?.completion_date)}</TableCell></TableRow>)}</TableBody></Table> : null}
      {totalPages > 1 ? <div className="flex justify-end gap-2 border-t pt-4"><Button disabled={page === 1} size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Badge variant="outline">Page {page} of {totalPages}</Badge><Button disabled={page === totalPages} size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button></div> : null}
    </CardContent></Card>
  </div>;
}
