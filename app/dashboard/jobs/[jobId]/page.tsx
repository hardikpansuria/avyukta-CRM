"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilePlus2Icon,
  PencilIcon,
  PrinterIcon,
  RotateCcwIcon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

import { JobCompletionDialog, type EditableCompletion } from "../job-completion-dialog";

type JobDetail = {
  id: string;
  job_number?: string | null;
  job_status: string;
  accepted_at?: string | null;
  quotation?: {
    quotation_number?: string | null;
    revision_number?: number | string | null;
    project_name?: string | null;
    grand_total_after_tax?: number | string | null;
    grand_total_before_tax?: number | string | null;
  } | null;
  customer?: { company_name?: string | null; currency?: string | null } | null;
  salesperson?: { full_name?: string | null; email?: string | null } | null;
  allocation?: { total_po_amount?: number | string | null } | null;
  purchase_order?: { id: string; po_number?: string | null } | null;
  invoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    invoice_amount: number | string;
    status: string;
  }>;
  invoice_requests: Array<{
    id: string;
    request_number: number | string;
    invoice_type: string;
    requested_amount: number | string;
    currency: string;
    status: string;
    created_at: string;
  }>;
  status_history: Array<{
    id: string;
    previous_status?: string | null;
    new_status: string;
    changed_at: string;
    remarks?: string | null;
    work_completion_id?: string | null;
    changed_by_profile?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
  }>;
  work_completions: Array<{
    id: string;
    certificate_number: string;
    revision_number: number;
    completion_date: string;
    completion_status: "completed" | "completed_with_outstanding_items";
    completion_notes?: string | null;
    outstanding_items?: string | null;
    completed_at: string;
    certificate_generated_at?: string | null;
    reopened_at?: string | null;
    reopen_reason?: string | null;
    correction_of_completion_id?: string | null;
    replaces_certificate_number?: string | null;
    technicians: Array<{ employee_id: string; employee_name: string }>;
    completed_by_profile?: { full_name?: string | null; email?: string | null } | null;
  }>;
  completion?: JobDetail["work_completions"][number] | null;
  totals: {
    allocated_po_total: number;
    invoiced: number;
    paid: number;
    outstanding: number;
    remaining_uninvoiced: number;
  };
};

function title(value: string) {
  if (value === "work_in_process") return "Work In Progress";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(Number(value ?? 0));
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-2 font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [canReopen, setCanReopen] = useState(false);
  const [canEditCompletion, setCanEditCompletion] = useState(false);
  const [editCompletionOpen, setEditCompletionOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/org/jobs/${jobId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { job?: JobDetail; permissions?: { can_reopen?: boolean; can_edit_completion?: boolean }; error?: string }
          | null;
        if (!response.ok || !payload?.job) {
          setError(payload?.error ?? "Unable to load job.");
        } else {
          setJob(payload.job);
          setCanReopen(payload.permissions?.can_reopen === true);
          setCanEditCompletion(payload.permissions?.can_edit_completion === true);
          setError(null);
        }
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load job.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [jobId, refresh]);

  async function reopenJob() {
    if (!reopenReason.trim() || reopening) return;
    setReopening(true);
    const response = await fetch(`/api/org/jobs/${jobId}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reopenReason }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update job status.");
    } else {
      setReopenOpen(false);
      setReopenReason("");
      setRefresh((value) => value + 1);
    }
    setReopening(false);
  }

  async function openCertificate(completionId: string, mode: "view" | "download" | "print") {
    setError(null);
    const response = await fetch(`/api/org/jobs/${jobId}/completion-certificates/${completionId}${mode === "download" ? "?download=1" : ""}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { signed_url?: string; error?: string } | null;
    if (!response.ok || !payload?.signed_url) return setError(payload?.error ?? "Unable to open completion certificate.");
    window.open(payload.signed_url, "_blank", "noopener,noreferrer");
  }

  if (loading) return <div className="mx-auto max-w-7xl">Loading job...</div>;
  if (!job) {
    return (
      <Alert>
        <AlertDescription>{error ?? "Job not found."}</AlertDescription>
      </Alert>
    );
  }
  const currency = job.customer?.currency ?? "CAD";
  const quotationTotal = Number(
    job.quotation?.grand_total_after_tax ??
      job.quotation?.grand_total_before_tax ??
      0,
  );
  const completion = job.completion;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button
        nativeButton={false}
        render={
          <Link
            href={
              job.job_status === "work_completed"
                ? "/dashboard/jobs/completed"
                : job.purchase_order
                ? `/dashboard/jobs/purchase-orders/${job.purchase_order.id}`
                : "/dashboard/jobs/po-pending"
            }
          />
        }
        variant="ghost"
      >
        <ArrowLeftIcon />
        Back
      </Button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-zinc-500">Job on the Go</p>
          <h1 className="text-2xl font-semibold">{job.job_number ?? "PO Pending"}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {job.customer?.company_name ?? "-"} ·{" "}
            {job.quotation?.project_name ?? "No project name"}
          </p>
        </div>
        {job.job_status === "work_in_process" ? (
          <Select
            value={job.job_status}
            onValueChange={(value) => {
              const next = String(value ?? "");
              if (next === "work_completed") setCompletionOpen(true);
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue>Work In Progress</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work_in_process">Work In Progress</SelectItem>
              <SelectItem value="work_completed">Work Completed</SelectItem>
            </SelectContent>
          </Select>
        ) : job.job_status === "work_completed" ? (
          <div className="flex items-center gap-2"><Badge variant="outline">Work Completed</Badge>{canReopen ? <Button size="sm" variant="outline" onClick={() => setReopenOpen(true)}><RotateCcwIcon />Reopen Job</Button> : null}</div>
        ) : (
          <Badge variant="outline">PO Pending</Badge>
        )}
      </div>
      {error ? (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Job Number" value={job.job_number ?? "-"} />
            <Detail
              label="Customer"
              value={job.customer?.company_name ?? "-"}
            />
            <Detail
              label="PO Number"
              value={job.purchase_order?.po_number ?? "-"}
            />
            <Detail
              label="Quotation Number"
              value={job.quotation?.quotation_number ?? "-"}
            />
            <Detail
              label="Revision"
              value={String(job.quotation?.revision_number ?? 0)}
            />
            <Detail
              label="Project"
              value={job.quotation?.project_name ?? "-"}
            />
            <Detail
              label="Quotation Total"
              value={money(quotationTotal, currency)}
            />
            <Detail
              label="Allocated PO Total"
              value={money(job.totals.allocated_po_total, currency)}
            />
            <Detail label="Job Status" value={title(job.job_status)} />
            <Detail
              label="Salesperson"
              value={
                job.salesperson?.full_name ||
                job.salesperson?.email ||
                "-"
              }
            />
            <Detail
              label="Accepted Date"
              value={
                job.accepted_at
                  ? new Date(job.accepted_at).toLocaleDateString("en-CA")
                  : "-"
              }
            />
          </dl>
        </CardContent>
      </Card>
      {completion ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Completion Information</CardTitle>
            <div className="flex flex-wrap gap-2">
              {canEditCompletion ? <Button size="sm" variant="outline" onClick={() => setEditCompletionOpen(true)}><PencilIcon />Edit Completion Information</Button> : null}
              <Button size="sm" onClick={() => void openCertificate(completion.id, "view")}><ExternalLinkIcon />View Completion Certificate</Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Detail label="Certificate" value={`${completion.certificate_number}${completion.revision_number > 1 ? ` - Revision ${completion.revision_number}` : ""}`} />
              <Detail label="Completion Date" value={new Date(`${completion.completion_date}T00:00:00Z`).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" })} />
              <Detail label="Technicians" value={completion.technicians.map((technician) => technician.employee_name).join(", ") || "-"} />
              <Detail label="Completed By" value={completion.completed_by_profile?.full_name || completion.completed_by_profile?.email || "System"} />
              <Detail label="Completion Status" value={completion.completion_status === "completed_with_outstanding_items" ? "Completed with Outstanding Items" : "Completed"} />
              <Detail label="Certificate Generated" value={completion.certificate_generated_at ? new Date(completion.certificate_generated_at).toLocaleString("en-CA") : "-"} />
            </dl>
            {completion.completion_notes ? <div className="mt-5 rounded-lg border p-4"><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Completion Notes</p><p className="mt-2 whitespace-pre-wrap text-sm">{completion.completion_notes}</p></div> : null}
            {completion.outstanding_items ? <div className="mt-5 rounded-lg border p-4"><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Outstanding Items</p><p className="mt-2 whitespace-pre-wrap text-sm">{completion.outstanding_items}</p></div> : null}
            {completion.reopen_reason ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30"><span className="font-medium">Reopened:</span> {completion.reopen_reason}</div> : null}
          </CardContent>
        </Card>
      ) : null}
      {job.work_completions.length ? (
        <Card>
          <CardHeader><CardTitle>Documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {job.work_completions.map((document) => <div className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center" key={document.id}><div><p className="font-medium">{document.certificate_number}{document.revision_number > 1 ? ` - Revision ${document.revision_number}` : ""}</p><p className="text-xs text-zinc-500">Work Completion Acknowledgement{document.replaces_certificate_number ? ` · Replaced ${document.replaces_certificate_number}` : ""} · {new Date(document.completed_at).toLocaleString("en-CA")}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void openCertificate(document.id, "view")}><ExternalLinkIcon />View</Button><Button size="sm" variant="outline" onClick={() => void openCertificate(document.id, "download")}><DownloadIcon />Download</Button><Button size="sm" variant="outline" onClick={() => void openCertificate(document.id, "print")}><PrinterIcon />Print</Button></div></div>)}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Summary
          label="PO Allocation"
          value={money(job.totals.allocated_po_total, currency)}
        />
        <Summary
          label="Total Invoiced"
          value={money(job.totals.invoiced, currency)}
        />
        <Summary label="Total Paid" value={money(job.totals.paid, currency)} />
        <Summary
          label="Outstanding"
          value={money(job.totals.outstanding, currency)}
        />
        <Summary
          label="Remaining Uninvoiced"
          value={money(job.totals.remaining_uninvoiced, currency)}
        />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Invoice Requests</CardTitle>
          {job.purchase_order ? (
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/invoice-requests/new?jobId=${job.id}`} />}
              size="sm"
            >
              <FilePlus2Icon />
              Request Invoice
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {job.invoice_requests.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Request</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
              <TableBody>
                {job.invoice_requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell><Link className="font-medium hover:underline" href={`/dashboard/invoice-requests/${request.id}`}>IR-{String(request.request_number).padStart(3, "0")}</Link></TableCell>
                    <TableCell>{title(request.invoice_type)}</TableCell>
                    <TableCell>{money(request.requested_amount, request.currency)}</TableCell>
                    <TableCell><Badge variant="outline">{title(request.status)}</Badge></TableCell>
                    <TableCell>{new Date(request.created_at).toLocaleDateString("en-CA")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <p className="text-sm text-zinc-500">No invoice requests submitted.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {job.invoices.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {job.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/dashboard/invoices/${invoice.id}`}
                      >
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{invoice.invoice_date}</TableCell>
                    <TableCell>
                      {money(invoice.invoice_amount, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{title(invoice.status)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-zinc-500">No invoices created.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Production Status History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.status_history.map((event, index) => (
            <div className="flex gap-3" key={event.id}>
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2 rounded-full bg-zinc-950 dark:bg-zinc-50" />
                {index < job.status_history.length - 1 ? (
                  <span className="h-full w-px bg-zinc-200 dark:bg-zinc-800" />
                ) : null}
              </div>
              <div className="pb-5">
                <p className="text-sm font-medium">
                  {title(event.previous_status ?? "created")} →{" "}
                  {title(event.new_status)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                  <CalendarClockIcon className="size-3" />
                  {new Date(event.changed_at).toLocaleString("en-CA")} ·{" "}
                  {event.changed_by_profile?.full_name ||
                    event.changed_by_profile?.email ||
                    "System"}
                </p>
                {event.remarks ? (
                  <p className="mt-1 text-sm text-zinc-500">{event.remarks}</p>
                ) : null}
                {event.work_completion_id ? (
                  <button className="mt-2 text-xs font-medium underline" type="button" onClick={() => void openCertificate(event.work_completion_id as string, "view")}>Certificate: {job.work_completions.find((item) => item.id === event.work_completion_id)?.certificate_number ?? "View"}</button>
                ) : null}
              </div>
            </div>
          ))}
          {!job.status_history.length ? (
            <p className="text-sm text-zinc-500">No status changes recorded.</p>
          ) : null}
        </CardContent>
      </Card>

      {completionOpen ? <JobCompletionDialog jobId={job.id} jobNumber={job.job_number} open onOpenChange={setCompletionOpen} onCompleted={() => setRefresh((value) => value + 1)} /> : null}
      {editCompletionOpen && completion ? <JobCompletionDialog
        initialCompletion={completion as EditableCompletion}
        jobId={job.id}
        jobNumber={job.job_number}
        open
        onOpenChange={setEditCompletionOpen}
        onCompleted={() => setRefresh((value) => value + 1)}
      /> : null}
      <Dialog open={reopenOpen} onOpenChange={(open) => !reopening && setReopenOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Job</DialogTitle>
            <DialogDescription>The original certificate remains preserved. The job will return to PO Received as Work in Progress.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label htmlFor="reopen-reason" required>Reason for Reopening</Label><Textarea className="min-h-28" id="reopen-reason" placeholder="Customer requested additional modification." required value={reopenReason} onChange={(event) => setReopenReason(event.target.value)} /></div>
          <DialogFooter>
            <Button disabled={reopening} type="button" variant="outline" onClick={() => setReopenOpen(false)}>Cancel</Button>
            <Button disabled={reopening || !reopenReason.trim()} type="button" onClick={() => void reopenJob()}>{reopening ? "Reopening..." : "Reopen Job"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
