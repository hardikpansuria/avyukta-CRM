"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SearchIcon, WorkflowIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { JobListItem } from "@/lib/jobs/types";

import { JobStatusTabs } from "../job-status-tabs";

export default function CancelledJobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(timeout);
  }, [search]);
  const query = useMemo(() => {
    const params = new URLSearchParams({ statuses: "cancelled,terminated", page: String(page), pageSize: "20" });
    if (debounced) params.set("search", debounced);
    return params.toString();
  }, [debounced, page]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(null);
      try {
        const response = await fetch(`/api/org/jobs?${query}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as { jobs?: JobListItem[]; pagination?: { totalPages: number }; error?: string } | null;
        if (!response.ok) setError(payload?.error ?? "Unable to load cancelled jobs.");
        else { setJobs(payload?.jobs ?? []); setTotalPages(payload?.pagination?.totalPages ?? 1); }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError("Unable to load cancelled jobs.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [query]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <div><div className="flex items-center gap-2 text-sm text-zinc-500"><WorkflowIcon className="size-4" />Job on the Go</div><h1 className="mt-1 text-2xl font-semibold">Cancelled / Terminated Jobs</h1><p className="mt-1 text-sm text-zinc-500">Stopped jobs remain visible with their reason and complete audit history.</p></div>
    <JobStatusTabs active="cancelled" />
    <Card><CardContent className="space-y-4">
      <label className="relative block max-w-xl"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" /><Input className="pl-9" placeholder="Search job, PO, quotation, customer, or project" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-14" key={index} />)}</div> : null}
      {!loading && !jobs.length ? <div className="min-h-52 rounded-lg border border-dashed p-10 text-center text-sm text-zinc-500">No cancelled or terminated jobs.</div> : null}
      {!loading && jobs.length ? <>
        <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead>Job #</TableHead><TableHead>Customer</TableHead><TableHead>PO</TableHead><TableHead>Project</TableHead><TableHead>Status</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{jobs.map((job) => <TableRow key={job.id}><TableCell><Link className="font-medium hover:underline" href={`/dashboard/jobs/${job.id}`}>{job.job_number ?? "-"}</Link></TableCell><TableCell>{job.customer?.company_name ?? "-"}</TableCell><TableCell>{job.purchase_orders.map((po) => po.po_number).join(", ") || "-"}</TableCell><TableCell>{job.quotation?.project_name ?? "-"}</TableCell><TableCell><Badge variant="outline">{job.job_status === "terminated" ? "Terminated" : "Cancelled"}</Badge></TableCell><TableCell>{(job as JobListItem & { status_reason?: string | null }).status_reason ?? "See audit history"}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="grid gap-3 md:hidden">{jobs.map((job) => <Card key={job.id}><CardContent className="space-y-2"><div className="flex items-start justify-between gap-3"><Link className="font-semibold hover:underline" href={`/dashboard/jobs/${job.id}`}>{job.job_number ?? "Job"}</Link><Badge variant="outline">{job.job_status === "terminated" ? "Terminated" : "Cancelled"}</Badge></div><p className="text-sm">{job.customer?.company_name ?? "-"}</p><p className="text-xs text-zinc-500">{job.quotation?.project_name ?? "No project name"}</p></CardContent></Card>)}</div>
      </> : null}
      {totalPages > 1 ? <div className="flex justify-end gap-2 border-t pt-4"><Button disabled={page === 1} size="sm" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button><Badge variant="outline">Page {page} of {totalPages}</Badge><Button disabled={page === totalPages} size="sm" variant="outline" onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</Button></div> : null}
    </CardContent></Card>
  </div>;
}
