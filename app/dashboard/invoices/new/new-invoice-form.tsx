"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  quotation?: { quotation_number?: string | null } | null;
  purchase_order?: { po_number?: string | null } | null;
  purchase_orders: Array<{
    id: string;
    po_number?: string | null;
    po_received_date?: string | null;
  }>;
  totals: {
    allocated_po_total: number;
    invoiced: number;
    remaining_uninvoiced: number;
  };
};

type CustomerOption = {
  id: string;
  company_name: string;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}

export function NewInvoiceForm({
  initialJobId,
  invoiceRequestId,
}: {
  initialJobId: string;
  invoiceRequestId: string;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [jobId, setJobId] = useState(initialJobId);
  const [job, setJob] = useState<Job | null>(null);
  const [purchaseOrderId, setPurchaseOrderId] = useState("");
  const [jobOptions, setJobOptions] = useState<
    Array<{
      id: string;
      customer_id: string;
      job_number?: string | null;
      job_status: string;
      customer?: { company_name?: string | null } | null;
    }>
  >([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [invoicePdf, setInvoicePdf] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    id: string;
    document_warning?: string | null;
  } | null>(null);
  const [requestReference, setRequestReference] = useState("");

  useEffect(() => {
    if (!invoiceRequestId) return;
    const controller = new AbortController();
    async function loadRequest() {
      try {
        const response = await fetch(
          `/api/org/invoice-requests/${invoiceRequestId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              request?: {
                job_id: string;
                request_number: number | string;
                requested_amount: number | string;
                billing_description: string;
                status: string;
                purchase_order_id: string;
              };
              error?: string;
            }
          | null;
        if (!response.ok || !payload?.request) {
          setError(payload?.error ?? "Unable to load invoice request.");
          return;
        }
        if (payload.request.status !== "under_review") {
          setError("Invoice request must be Under Review before an invoice can be uploaded.");
          return;
        }
        setJobId(payload.request.job_id);
        setInvoiceAmount(String(payload.request.requested_amount));
        setRemarks(payload.request.billing_description);
        setRequestReference(`IR-${String(payload.request.request_number).padStart(3, "0")}`);
        setPurchaseOrderId(payload.request.purchase_order_id);
      } catch {
        if (!controller.signal.aborted) setError("Unable to load invoice request.");
      }
    }
    void loadRequest();
    return () => controller.abort();
  }, [invoiceRequestId]);

  useEffect(() => {
    if (initialJobId || invoiceRequestId) return;
    const controller = new AbortController();
    async function loadCustomers() {
      try {
        const response = await fetch("/api/org/customers", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { customers?: CustomerOption[]; error?: string }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load customers.");
          return;
        }
        setCustomerOptions(payload?.customers ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load customers.");
        }
      }
    }
    void loadCustomers();
    return () => controller.abort();
  }, [initialJobId, invoiceRequestId]);

  useEffect(() => {
    if (initialJobId || invoiceRequestId || !selectedCustomerId) {
      return;
    }

    const controller = new AbortController();
    async function loadJobs() {
      try {
        const response = await fetch(
          `/api/org/jobs?pageSize=100&customer_id=${encodeURIComponent(selectedCustomerId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | { jobs?: typeof jobOptions; error?: string }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load jobs.");
          return;
        }
        setJobOptions(
          (payload?.jobs ?? []).filter((option) =>
            ["work_in_process", "on_hold", "work_completed"].includes(option.job_status),
          ),
        );
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load jobs.");
        }
      }
    }
    void loadJobs();
    return () => controller.abort();
  }, [initialJobId, invoiceRequestId, selectedCustomerId]);

  useEffect(() => {
    if (!jobId) {
      return;
    }
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/org/jobs/${jobId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { job?: Job; error?: string }
          | null;
        if (!response.ok || !payload?.job) {
          setError(payload?.error ?? "Unable to load job.");
          return;
        }
        const loadedJob = payload.job;
        setJob(loadedJob);
        setSelectedCustomerId(loadedJob.customer_id);
        setPurchaseOrderId((current) => current || (
          loadedJob.purchase_orders?.length === 1
            ? loadedJob.purchase_orders[0].id
            : ""
        ));
        setError(null);
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load job.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [jobId]);

  const amount = Number(invoiceAmount || 0);
  const overBy = job
    ? job.totals.invoiced + amount - job.totals.allocated_po_total
    : 0;
  const overInvoicing = overBy > 0.005;
  const currency = job?.customer?.currency ?? "CAD";
  const selectedCustomer = customerOptions.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const selectedJobOption = jobOptions.find((option) => option.id === jobId);
  const selectedPurchaseOrder = job?.purchase_orders.find(
    (purchaseOrder) => purchaseOrder.id === purchaseOrderId,
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!job || submitting || (overInvoicing && !acknowledged)) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("customer_id", selectedCustomerId);
    form.set("job_id", job.id);
    form.set("purchase_order_id", purchaseOrderId);
    form.set("invoice_number", invoiceNumber);
    form.set("invoice_date", invoiceDate);
    form.set("invoice_amount", invoiceAmount);
    form.set("remarks", remarks);
    form.set("over_invoicing_acknowledged", String(acknowledged));
    if (invoiceRequestId) form.set("invoice_request_id", invoiceRequestId);
    if (invoicePdf) form.set("invoice_pdf", invoicePdf);
    try {
      const response = await fetch("/api/org/job-invoices", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            invoice?: { id: string };
            document_warning?: string | null;
            error?: string;
          }
        | null;
      if (!response.ok || !payload?.invoice) {
        setError(payload?.error ?? "Unable to create invoice.");
        return;
      }
      setResult({
        id: payload.invoice.id,
        document_warning: payload.document_warning,
      });
    } catch {
      setError("Unable to create invoice.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2Icon className="mx-auto size-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-semibold">Invoice copy uploaded</h1>
            {result.document_warning ? (
              <Alert className="mt-5 text-left">
                <AlertTriangleIcon />
                <AlertTitle>Document upload needs attention</AlertTitle>
                <AlertDescription>{result.document_warning}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="mt-6"
              nativeButton={false}
              render={<Link href={`/dashboard/invoices/${result.id}`} />}
            >
              View Invoice
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-5xl space-y-6" onSubmit={submit}>
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/invoices" />}
        variant="ghost"
      >
        <ArrowLeftIcon />
        Back to Invoices
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">Upload Invoice</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Record an invoice created in your company invoice system and upload its PDF copy.
          {requestReference ? ` Linked request: ${requestReference}.` : ""}
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Unable to continue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!initialJobId && !invoiceRequestId ? (
        <Card>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>Customer</Label>
              <Select
                value={selectedCustomerId}
                onValueChange={(value) => {
                  setSelectedCustomerId(String(value ?? ""));
                  setJobId("");
                  setJob(null);
                  setJobOptions([]);
                  setAcknowledged(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select customer">
                    {selectedCustomer?.company_name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label required>Select Job</Label>
              <Select
                disabled={!selectedCustomerId}
                value={jobId}
                onValueChange={(value) => {
                  setJob(null);
                  setJobId(String(value ?? ""));
                  setAcknowledged(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a job with a received PO">
                    {selectedJobOption
                      ? `${selectedJobOption.job_number ?? "Pending"} · ${
                          selectedJobOption.customer?.company_name ?? "Customer"
                        }`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {jobOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.job_number ?? "Pending"} ·{" "}
                      {option.customer?.company_name ?? "Customer"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-zinc-500">
                Only jobs with a received purchase order are available.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
      {job ? (
        <>
          {job.purchase_orders.length > 1 ? (
            <Card>
              <CardHeader><CardTitle>Select Purchase Order</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label required>Active PO for this invoice</Label>
                <Select value={purchaseOrderId} onValueChange={(value) => setPurchaseOrderId(String(value))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select an active PO" /></SelectTrigger>
                  <SelectContent>{job.purchase_orders.map((po) => <SelectItem key={po.id} value={po.id}>{po.po_number ?? "PO"} · {po.po_received_date ?? "Date unavailable"}</SelectItem>)}</SelectContent>
                </Select>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>Job and allocation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Job Number", job.job_number ?? "-"],
                ["Quotation", job.quotation?.quotation_number ?? "-"],
                ["PO Number", selectedPurchaseOrder?.po_number ?? job.purchase_order?.po_number ?? "-"],
                ["Customer", job.customer?.company_name ?? "-"],
                [
                  "PO Allocation",
                  money(job.totals.allocated_po_total, currency),
                ],
                ["Previously Invoiced", money(job.totals.invoiced, currency)],
                [
                  "Remaining Amount",
                  money(job.totals.remaining_uninvoiced, currency),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-medium">{value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invoice details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice-number" required>Invoice Number</Label>
                <Input
                  id="invoice-number"
                  required
                  value={invoiceNumber}
                  onChange={(event) => setInvoiceNumber(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-date" required>Invoice Date</Label>
                <Input
                  id="invoice-date"
                  required
                  type="date"
                  value={invoiceDate}
                  onChange={(event) => setInvoiceDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-amount" required>Invoice Amount</Label>
                <Input
                  id="invoice-amount"
                  min="0"
                  required
                  step="0.01"
                  type="number"
                  value={invoiceAmount}
                  onChange={(event) => {
                    setInvoiceAmount(event.target.value);
                    setAcknowledged(false);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-pdf" required>Invoice PDF</Label>
                <Input
                  accept="application/pdf"
                  id="invoice-pdf"
                  required
                  type="file"
                  onChange={(event) =>
                    setInvoicePdf(event.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoice-remarks">Remarks</Label>
                <Textarea
                  id="invoice-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                />
              </div>
              {overInvoicing ? (
                <Alert className="sm:col-span-2">
                  <AlertTriangleIcon />
                  <AlertTitle>Invoice exceeds PO allocation</AlertTitle>
                  <AlertDescription>
                    <p>
                      The cumulative invoice total is {money(overBy, currency)}{" "}
                      above the job allocation.
                    </p>
                    <label className="mt-3 flex items-start gap-2">
                      <Checkbox
                        checked={acknowledged}
                        onChange={(event) =>
                          setAcknowledged(event.target.checked)
                        }
                      />
                      <span>
                        I acknowledge that this invoice exceeds the job PO
                        allocation.
                      </span>
                    </label>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button
              disabled={
                submitting ||
                !invoiceNumber.trim() ||
                !invoiceDate ||
                !invoiceAmount ||
                !invoicePdf ||
                !purchaseOrderId ||
                amount < 0 ||
                (overInvoicing && !acknowledged)
              }
              type="submit"
            >
              {submitting ? "Uploading..." : "Upload Invoice Copy"}
            </Button>
          </div>
        </>
      ) : null}
    </form>
  );
}
