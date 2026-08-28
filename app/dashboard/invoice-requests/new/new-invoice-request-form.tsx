"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Job = {
  id: string;
  customer_id: string;
  job_number?: string | null;
  job_status: string;
  customer?: { company_name?: string | null; currency?: string | null } | null;
  quotation?: { quotation_number?: string | null; revision_number?: number | null; project_name?: string | null } | null;
  purchase_order?: { po_number?: string | null; po_received_date?: string | null } | null;
  salesperson?: { full_name?: string | null; email?: string | null } | null;
  totals: { allocated_po_total: number; invoiced: number; remaining_uninvoiced: number };
};
type Customer = { id: string; company_name: string };
type JobOption = {
  id: string;
  customer_id: string;
  job_number?: string | null;
  job_status: string;
  customer?: { company_name?: string | null } | null;
};

const itemOptions = [
  ["tank_fabrication", "Tank fabrication"],
  ["installation", "Installation"],
  ["passivation", "Passivation"],
  ["freight", "Freight"],
  ["engineering", "Engineering"],
  ["material_supplied", "Material supplied"],
  ["change_order", "Change Order"],
] as const;

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value);
}

function title(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function NewInvoiceRequestForm({ initialJobId }: { initialJobId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobId, setJobId] = useState(initialJobId);
  const [job, setJob] = useState<Job | null>(null);
  const [invoiceType, setInvoiceType] = useState("deposit");
  const [amountType, setAmountType] = useState("percentage");
  const [amountValue, setAmountValue] = useState("50");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; number: number | string; warnings: string[] } | null>(null);

  useEffect(() => {
    if (initialJobId) return;
    const controller = new AbortController();
    void fetch("/api/org/customers", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) setError(payload.error ?? "Unable to load customers.");
        else setCustomers(payload.customers ?? []);
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load customers."); });
    return () => controller.abort();
  }, [initialJobId]);

  useEffect(() => {
    if (initialJobId || !customerId) return;
    const controller = new AbortController();
    void fetch(`/api/org/jobs?pageSize=100&customer_id=${encodeURIComponent(customerId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok) setError(payload.error ?? "Unable to load jobs.");
        else setJobs((payload.jobs ?? []).filter((option: JobOption) => option.job_status !== "po_pending"));
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load jobs."); })
      .finally(() => { if (!controller.signal.aborted) setJobsLoading(false); });
    return () => controller.abort();
  }, [customerId, initialJobId]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    void fetch(`/api/org/jobs/${jobId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload.job) setError(payload.error ?? "Unable to load job.");
        else {
          setJob(payload.job);
          setCustomerId(payload.job.customer_id);
          setError(null);
        }
      })
      .catch(() => { if (!controller.signal.aborted) setError("Unable to load job."); });
    return () => controller.abort();
  }, [jobId]);

  const currency = job?.customer?.currency ?? "CAD";
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedJob = jobs.find((option) => option.id === jobId);
  const calculated = job
    ? amountType === "percentage"
      ? job.totals.allocated_po_total * Number(amountValue || 0) / 100
      : amountType === "remaining_balance"
        ? job.totals.remaining_uninvoiced
        : Number(amountValue || 0)
    : 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!job || submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("job_id", job.id);
    form.set("invoice_type", invoiceType);
    form.set("amount_type", amountType);
    form.set("amount_value", amountType === "remaining_balance" ? "0" : amountValue);
    form.set("billing_description", description);
    form.set("items_to_include", JSON.stringify(items));
    form.set("comments_for_accounts", comments);
    files.forEach((file) => form.append("supporting_documents", file));
    try {
      const response = await fetch("/api/org/invoice-requests", { method: "POST", body: form });
      const payload = (await response.json().catch(() => null)) as
        | { request?: { id: string; request_number: number | string }; upload_warnings?: string[]; error?: string }
        | null;
      if (!response.ok || !payload?.request) setError(payload?.error ?? "Unable to submit invoice request.");
      else setResult({ id: payload.request.id, number: payload.request.request_number, warnings: payload.upload_warnings ?? [] });
    } catch {
      setError("Unable to submit invoice request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="py-12 text-center">
          <CheckCircle2Icon className="mx-auto size-12 text-emerald-600" />
          <h1 className="mt-4 text-2xl font-semibold">Invoice request submitted</h1>
          <p className="mt-2 text-sm text-zinc-500">IR-{String(result.number).padStart(3, "0")} is waiting for Accounts.</p>
          {result.warnings.length ? <Alert className="mt-5 text-left"><AlertDescription>These files could not be uploaded: {result.warnings.join(", ")}</AlertDescription></Alert> : null}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button nativeButton={false} render={<Link href={`/dashboard/invoice-requests/${result.id}`} />}>View Request</Button>
            {initialJobId ? (
              <Button nativeButton={false} render={<Link href="/dashboard/invoices/unbilled-jobs" />} variant="outline">
                Back to Unbilled Jobs
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form className="mx-auto max-w-5xl space-y-6" onSubmit={submit}>
      <Button
        nativeButton={false}
        render={
          <Link
            href={
              initialJobId
                ? "/dashboard/invoices/unbilled-jobs"
                : "/dashboard/invoice-requests"
            }
          />
        }
        variant="ghost"
      >
        <ArrowLeftIcon />
        {initialJobId ? "Back to Unbilled Jobs" : "Back to Requests"}
      </Button>
      <div><h1 className="text-2xl font-semibold">Request Invoice</h1><p className="mt-1 text-sm text-zinc-500">PO and customer billing data is copied automatically. Complete only the billing instructions.</p></div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {!initialJobId ? (
        <Card><CardHeader><CardTitle>Select billing job</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label required>Customer</Label>
            <Select
              value={customerId}
              onValueChange={(value) => {
                setCustomerId(String(value));
                setJobId("");
                setJob(null);
                setJobs([]);
                setJobsLoading(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select customer">
                  {selectedCustomer?.company_name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label required>Job with PO Received</Label>
            <Select
              disabled={!customerId || jobsLoading}
              value={jobId}
              onValueChange={(value) => setJobId(String(value))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    jobsLoading
                      ? "Loading jobs..."
                      : customerId && jobs.length === 0
                        ? "No Job Available"
                        : "Select job"
                  }
                >
                  {selectedJob
                    ? `${selectedJob.job_number ?? "Job number pending"} · ${
                        selectedJob.customer?.company_name ??
                        selectedCustomer?.company_name ??
                        "Customer"
                      }`
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {jobs.length === 0 ? (
                  <SelectItem disabled value="no-job-available">
                    No Job Available
                  </SelectItem>
                ) : (
                  jobs.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.job_number ?? "Job number pending"} ·{" "}
                      {option.customer?.company_name ??
                        selectedCustomer?.company_name ??
                        "Customer"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent></Card>
      ) : null}
      {job ? <>
        <Card><CardHeader><CardTitle>Auto-fetched from accepted PO</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Job Number", job.job_number ?? "-"], ["PO Number", job.purchase_order?.po_number ?? "-"],
            ["PO Received", job.purchase_order?.po_received_date ?? "-"], ["Customer", job.customer?.company_name ?? "-"],
            ["Project", job.quotation?.project_name ?? "-"], ["Quotation", job.quotation?.quotation_number ?? "-"],
            ["Revision", String(job.quotation?.revision_number ?? 0)], ["Salesperson", job.salesperson?.full_name ?? job.salesperson?.email ?? "-"],
            ["PO Total", money(job.totals.allocated_po_total, currency)], ["Previously Invoiced", money(job.totals.invoiced, currency)],
            ["Remaining", money(job.totals.remaining_uninvoiced, currency)],
          ].map(([label, value]) => <div key={label}><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Billing instructions</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2"><Label required>Invoice Type</Label><Select value={invoiceType} onValueChange={(value) => setInvoiceType(String(value))}><SelectTrigger className="w-full"><SelectValue>{title(invoiceType)}</SelectValue></SelectTrigger><SelectContent>{["deposit", "progress", "final", "change_order", "credit_note"].map((value) => <SelectItem key={value} value={value}>{title(value)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label required>Amount Method</Label><Select value={amountType} onValueChange={(value) => setAmountType(String(value))}><SelectTrigger className="w-full"><SelectValue>{amountType === "percentage" ? "Percentage of PO" : amountType === "remaining_balance" ? "Remaining Balance" : "Fixed Amount"}</SelectValue></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage of PO</SelectItem><SelectItem value="remaining_balance">Remaining Balance</SelectItem><SelectItem value="fixed_amount">Fixed Amount</SelectItem></SelectContent></Select></div>
          {amountType !== "remaining_balance" ? <div className="space-y-2"><Label htmlFor="request-amount" required>{amountType === "percentage" ? "Percentage" : "Fixed Amount"}</Label><Input id="request-amount" min="0" max={amountType === "percentage" ? "100" : undefined} required step="0.01" type="number" value={amountValue} onChange={(event) => setAmountValue(event.target.value)} /></div> : null}
          <div className="rounded-md bg-zinc-50 p-4"><p className="text-xs uppercase tracking-wide text-zinc-500">Calculated request</p><p className="mt-2 text-xl font-semibold">{money(calculated, currency)}</p></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="billing-description" required>Billing Description</Label><Textarea id="billing-description" required placeholder="e.g. Deposit for fabrication" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="space-y-3 sm:col-span-2"><Label>Items to Include</Label><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{itemOptions.map(([value, label]) => <label className="flex items-center gap-2 text-sm" key={value}><Checkbox checked={items.includes(value)} onChange={(event) => setItems((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{label}</label>)}</div></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="supporting-documents">Supporting Documents</Label><Input accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" id="supporting-documents" multiple type="file" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><p className="text-xs text-zinc-500">Delivery slips, site reports, photos, completion approvals, and packing slips. Maximum 15 MB each.</p></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="accounts-comments">Comments for Accounts</Label><Textarea id="accounts-comments" placeholder="e.g. Customer requested invoice before Friday." value={comments} onChange={(event) => setComments(event.target.value)} /></div>
        </CardContent></Card>
        <div className="flex justify-end"><Button disabled={submitting || !description.trim() || calculated <= 0} type="submit">{submitting ? "Submitting..." : "Submit Invoice Request"}</Button></div>
      </> : null}
    </form>
  );
}
