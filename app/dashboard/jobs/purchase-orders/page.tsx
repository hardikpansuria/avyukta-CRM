"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon, WorkflowIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { JobListItem } from "@/lib/jobs/types";

import { JobCompletionDialog } from "../job-completion-dialog";
import { JobStatusTabs } from "../job-status-tabs";

type PageResult = { jobs?: JobListItem[]; error?: string; pagination?: { totalPages: number } };

function salesperson(job: JobListItem) {
  return job.salesperson?.full_name || job.salesperson?.email || "-";
}

export default function PurchaseOrdersPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completionJob, setCompletionJob] = useState<JobListItem | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const query = useMemo(() => {
    const params = new URLSearchParams({ status: "work_in_process", page: String(page), pageSize: "20" });
    if (debounced) params.set("search", debounced);
    return params.toString();
  }, [debounced, page]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/org/jobs?${query}`, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as PageResult | null;
        if (!response.ok) setError(payload?.error ?? "Unable to load active jobs.");
        else { setJobs(payload?.jobs ?? []); setTotalPages(payload?.pagination?.totalPages ?? 1); }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError("Unable to load active jobs.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div><div className="flex items-center gap-2 text-sm text-zinc-500"><WorkflowIcon className="size-4" />Job on the Go</div><h1 className="mt-1 text-2xl font-semibold">PO Received</h1><p className="mt-1 text-sm text-zinc-500">Active jobs with a received customer PO.</p></div>
      <JobStatusTabs active="po_received" />
      <Card><CardContent className="space-y-4">
        <label className="relative block max-w-xl"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input className="pl-9" placeholder="Search job, PO, quotation, customer, project, or sales rep" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {error ? <div className="rounded-lg border border-red-200 p-4 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-14" key={index} />)}</div> : null}
        {!loading && !jobs.length ? <div className="min-h-52 rounded-lg border border-dashed p-10 text-center text-sm text-zinc-500">No active PO Received jobs found.</div> : null}
        {!loading && jobs.length ? <Table><TableHeader><TableRow><TableHead>Job #</TableHead><TableHead>Customer</TableHead><TableHead>PO #</TableHead><TableHead>Project</TableHead><TableHead>Sales Rep</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
          {jobs.map((job) => <TableRow key={job.id}>
            <TableCell><Link className="font-medium hover:underline" href={`/dashboard/jobs/${job.id}`}>{job.job_number ?? "-"}</Link></TableCell>
            <TableCell>{job.customer?.company_name ?? "-"}</TableCell>
            <TableCell>{job.purchase_order ? <Link className="hover:underline" href={`/dashboard/jobs/purchase-orders/${job.purchase_order.id}`}>{job.purchase_order.po_number}</Link> : "-"}</TableCell>
            <TableCell>{job.quotation?.project_name ?? "-"}</TableCell>
            <TableCell>{salesperson(job)}</TableCell>
            <TableCell><Select value="work_in_process" onValueChange={(value) => { if (value === "work_completed") setCompletionJob(job); }}><SelectTrigger className="w-44"><SelectValue>Work In Progress</SelectValue></SelectTrigger><SelectContent><SelectItem value="work_in_process">Work In Progress</SelectItem><SelectItem value="work_completed">Work Completed</SelectItem></SelectContent></Select></TableCell>
          </TableRow>)}
        </TableBody></Table> : null}
        {totalPages > 1 ? <div className="flex justify-end gap-2 border-t pt-4"><Button disabled={page === 1} size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Badge variant="outline">Page {page} of {totalPages}</Badge><Button disabled={page === totalPages} size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button></div> : null}
      </CardContent></Card>
      {completionJob ? <JobCompletionDialog jobId={completionJob.id} jobNumber={completionJob.job_number} open onOpenChange={(open) => { if (!open) setCompletionJob(null); }} onCompleted={() => { setJobs((current) => current.filter((job) => job.id !== completionJob.id)); setCompletionJob(null); }} /> : null}
    </div>
  );
}
