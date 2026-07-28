"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  FilePlus2Icon,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  status_history: Array<{
    id: string;
    previous_status?: string | null;
    new_status: string;
    changed_at: string;
    remarks?: string | null;
    changed_by_profile?: {
      full_name?: string | null;
      email?: string | null;
    } | null;
  }>;
  totals: {
    allocated_po_total: number;
    invoiced: number;
    paid: number;
    outstanding: number;
    remaining_uninvoiced: number;
  };
};

function title(value: string) {
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
  const [pendingStatus, setPendingStatus] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      const response = await fetch(`/api/org/jobs/${jobId}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { job?: JobDetail; error?: string }
        | null;
      if (!response.ok || !payload?.job) {
        setError(payload?.error ?? "Unable to load job.");
      } else {
        setJob(payload.job);
        setError(null);
      }
      if (!controller.signal.aborted) setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [jobId, refresh]);

  async function confirmStatus() {
    if (!pendingStatus || updating) return;
    setUpdating(true);
    const response = await fetch(`/api/org/jobs/${jobId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: pendingStatus }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update job status.");
    } else {
      setDialogOpen(false);
      setPendingStatus("");
      setRefresh((value) => value + 1);
    }
    setUpdating(false);
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button
        nativeButton={false}
        render={
          <Link
            href={
              job.purchase_order
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
        {job.job_status !== "po_pending" ? (
          <Select
            value={job.job_status}
            onValueChange={(value) => {
              const next = String(value ?? "");
              if (next && next !== job.job_status) {
                setPendingStatus(next);
                setDialogOpen(true);
              }
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work_in_process">Work in Process</SelectItem>
              <SelectItem value="work_completed">Work Completed</SelectItem>
            </SelectContent>
          </Select>
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
          <CardTitle>Invoices</CardTitle>
          {job.purchase_order ? (
            <Button
              nativeButton={false}
              render={
                <Link href={`/dashboard/invoices/new?jobId=${job.id}`} />
              }
              size="sm"
            >
              <FilePlus2Icon />
              Create Invoice
            </Button>
          ) : null}
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
              </div>
            </div>
          ))}
          {!job.status_history.length ? (
            <p className="text-sm text-zinc-500">No status changes recorded.</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setPendingStatus("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm production status</DialogTitle>
            <DialogDescription>
              Change {job.job_number} from {title(job.job_status)} to{" "}
              {title(pendingStatus)}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={updating}
              type="button"
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setPendingStatus("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={updating || !pendingStatus}
              type="button"
              onClick={() => void confirmStatus()}
            >
              {updating ? "Updating..." : "Yes, Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

