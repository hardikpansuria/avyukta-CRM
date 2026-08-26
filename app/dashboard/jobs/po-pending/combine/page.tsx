"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { JobListItem } from "@/lib/jobs/types";
import { PoDuplicateDialog } from "../po-duplicate-dialog";

type Selection = { selected: boolean; amount: string; acknowledged: boolean; scopeIds: string[] };

function numeric(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function money(value: number, currency = "CAD") {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}

export default function CombinePurchaseOrderPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [poPdf, setPoPdf] = useState<File | null>(null);
  const [supporting, setSupporting] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    purchase_order_id: string;
    jobs?: Array<{ job_number?: string | null }>;
    document_warning?: string | null;
  } | null>(null);
  const [existingPo, setExistingPo] = useState<{ id: string; po_number: string } | null>(null);

  async function checkDuplicate() {
    if (!customerId || !poNumber.trim()) return;
    const params = new URLSearchParams({
      customer_id: customerId,
      po_number: poNumber.trim(),
    });
    const response = await fetch(`/api/org/job-purchase-orders?${params}`, {
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as
      | { existing_purchase_order?: { id: string; po_number: string } | null }
      | null;
    if (response.ok && payload?.existing_purchase_order) {
      setExistingPo(payload.existing_purchase_order);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          "/api/org/jobs/po-pending?pageSize=100",
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | { jobs?: JobListItem[]; error?: string }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load jobs.");
          return;
        }
        setJobs(payload?.jobs ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load jobs.");
        }
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  const customers = useMemo(() => {
    const map = new Map<string, string>();
    jobs.forEach((job) => {
      if (job.customer?.company_name) {
        map.set(job.customer_id, job.customer.company_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);
  const customerJobs = jobs.filter((job) => job.customer_id === customerId);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedJobs = customerJobs.filter(
    (job) => selections[job.id]?.selected,
  );
  const currency = selectedJobs[0]?.customer?.currency ?? "CAD";
  const calculations = selectedJobs.map((job) => {
    const quoteTotal = numeric(
      job.quotation?.grand_total_after_tax ??
        job.quotation?.grand_total_before_tax,
    );
    const beforeTax = numeric(selections[job.id]?.amount);
    const taxRate = numeric(job.quotation?.tax_rate);
    const tax = beforeTax * (taxRate / 100);
    const total = beforeTax + tax;
    return { job, quoteTotal, beforeTax, taxRate, tax, total, difference: total - quoteTotal };
  });
  const summary = calculations.reduce(
    (totals, row) => ({
      quote: totals.quote + row.quoteTotal,
      beforeTax: totals.beforeTax + row.beforeTax,
      tax: totals.tax + row.tax,
      total: totals.total + row.total,
      difference: totals.difference + row.difference,
    }),
    { quote: 0, beforeTax: 0, tax: 0, total: 0, difference: 0 },
  );
  const unacknowledged = calculations.some(
    ({ job, difference }) =>
      Math.abs(difference) >= 0.005 && !selections[job.id]?.acknowledged,
  );

  function updateSelection(jobId: string, patch: Partial<Selection>) {
    setSelections((current) => ({
      ...current,
      [jobId]: {
        selected: current[jobId]?.selected ?? false,
        amount: current[jobId]?.amount ?? "",
        acknowledged: current[jobId]?.acknowledged ?? false,
        scopeIds: current[jobId]?.scopeIds ?? jobs.find((job) => job.id === jobId)?.assigned_scopes.map((scope) => scope.id) ?? [],
        ...patch,
      },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedJobs.length || unacknowledged || submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("po_number", poNumber);
    form.set("po_received_date", poDate);
    form.set("internal_remarks", remarks);
    form.set(
      "allocations",
      JSON.stringify(
        calculations.map(({ job, beforeTax }) => ({
          job_id: job.id,
          po_amount_before_tax: beforeTax,
          difference_acknowledged: selections[job.id].acknowledged,
          scope_ids: selections[job.id].scopeIds,
        })),
      ),
    );
    if (poPdf) form.set("po_pdf", poPdf);
    supporting.forEach((file) => form.append("supporting_documents", file));
    try {
      const response = await fetch("/api/org/job-purchase-orders", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
          | {
            purchase_order_id?: string;
            jobs?: Array<{ job_number?: string | null }>;
            document_warning?: string | null;
            error?: string;
            code?: string;
            existing_purchase_order?: { id: string; po_number: string };
          }
        | null;
      if (!response.ok || !payload?.purchase_order_id) {
        if (payload?.code === "PO_EXISTS" && payload.existing_purchase_order) {
          setExistingPo(payload.existing_purchase_order);
          return;
        }
        setError(payload?.error ?? "Unable to create combined PO.");
        return;
      }
      setResult({
        purchase_order_id: payload.purchase_order_id,
        jobs: payload.jobs,
        document_warning: payload.document_warning,
      });
    } catch {
      setError("Unable to create combined PO.");
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
            <h1 className="mt-4 text-2xl font-semibold">Combined PO created</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Generated job numbers:{" "}
              {result.jobs?.map((job) => job.job_number).filter(Boolean).join(", ") ||
                "-"}
            </p>
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
              render={
                <Link
                  href={`/dashboard/jobs/purchase-orders/${result.purchase_order_id}`}
                />
              }
            >
              View Purchase Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <form className="mx-auto max-w-7xl space-y-6" onSubmit={submit}>
      <PoDuplicateDialog
        existingPo={existingPo}
        jobIds={selectedJobs.map((job) => job.id)}
        onClose={() => setExistingPo(null)}
      />
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/jobs/po-pending" />}
        variant="ghost"
      >
        <ArrowLeftIcon />
        Back to PO Pending
      </Button>
      <div>
        <h1 className="text-2xl font-semibold">Combine Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Select one customer, then allocate the PO independently to one or more
          accepted quotations.
        </p>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Unable to continue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select
              value={customerId}
              onValueChange={(value) => {
                setCustomerId(String(value ?? ""));
                setSelections({});
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {selectedCustomer?.name ?? "Select customer"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="combine-number">Purchase Order Number</Label>
            <Input
              id="combine-number"
              required
              value={poNumber}
              onBlur={() => void checkDuplicate()}
              onChange={(event) => setPoNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="combine-date">PO Received Date</Label>
            <Input
              id="combine-date"
              required
              type="date"
              value={poDate}
              onChange={(event) => setPoDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="combine-pdf">PO PDF</Label>
            <Input
              accept="application/pdf"
              id="combine-pdf"
              type="file"
              onChange={(event) => setPoPdf(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="combine-remarks">Internal Remarks</Label>
            <Textarea
              id="combine-remarks"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="combine-supporting">Supporting Documents</Label>
            <Input
              accept="application/pdf,image/jpeg,image/png,image/webp"
              id="combine-supporting"
              multiple
              type="file"
              onChange={(event) =>
                setSupporting(Array.from(event.target.files ?? []))
              }
            />
          </div>
        </CardContent>
      </Card>

      {customerId ? (
        <Card>
          <CardHeader>
            <CardTitle>PO Pending jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Select</TableHead>
                  <TableHead>Quotation</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Quotation Total</TableHead>
                  <TableHead>PO Before Tax</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>PO Total</TableHead>
                  <TableHead>Difference</TableHead>
                  <TableHead>Acknowledge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerJobs.map((job) => {
                  const selected = selections[job.id]?.selected;
                  const quote = numeric(
                    job.quotation?.grand_total_after_tax ??
                      job.quotation?.grand_total_before_tax,
                  );
                  const before = numeric(selections[job.id]?.amount);
                  const tax = before * (numeric(job.quotation?.tax_rate) / 100);
                  const total = before + tax;
                  const difference = total - quote;
                  const differs = selected && Math.abs(difference) >= 0.005;
                  return (
                    <TableRow key={job.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected ?? false}
                          onChange={(event) =>
                            updateSelection(job.id, {
                              selected: event.target.checked,
                              amount: event.target.checked
                                ? selections[job.id]?.amount || ""
                                : "",
                              acknowledged: false,
                              scopeIds: event.target.checked ? job.assigned_scopes.map((scope) => scope.id) : [],
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {job.quotation?.quotation_number ?? "-"}
                      </TableCell>
                      <TableCell>
                        {job.quotation?.revision_number ?? 0}
                      </TableCell>
                      <TableCell>{job.quotation?.project_name ?? "-"}</TableCell>
                      <TableCell>{money(quote, currency)}</TableCell>
                      <TableCell>
                        <Input
                          className="min-w-32"
                          disabled={!selected}
                          min="0"
                          step="0.01"
                          type="number"
                          value={selections[job.id]?.amount ?? ""}
                          onChange={(event) =>
                            updateSelection(job.id, {
                              amount: event.target.value,
                              acknowledged: false,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {money(tax, currency)} (
                        {numeric(job.quotation?.tax_rate)}%)
                      </TableCell>
                      <TableCell>{money(total, currency)}</TableCell>
                      <TableCell
                        className={differs ? "text-amber-700" : undefined}
                      >
                        {money(difference, currency)}
                      </TableCell>
                      <TableCell>
                        {differs ? (
                          <Checkbox
                            checked={
                              selections[job.id]?.acknowledged ?? false
                            }
                            onChange={(event) =>
                              updateSelection(job.id, {
                                acknowledged: event.target.checked,
                              })
                            }
                          />
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {selectedJobs.length ? (
        <Card>
          <CardHeader><CardTitle>Work Order Scopes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">Choose the scope(s) covered by each Work Order. Only these scopes will appear on its completion acknowledgement.</p>
            {selectedJobs.map((job) => <div className="rounded-lg border p-4" key={job.id}><p className="mb-3 text-sm font-semibold">{job.quotation?.quotation_number ?? job.job_number ?? "Job"} - {job.quotation?.project_name ?? "No project name"}</p><div className="grid gap-2 sm:grid-cols-2">{job.assigned_scopes.map((scope) => <label className="flex items-start gap-2 rounded-md border p-3 text-sm" key={scope.id}><Checkbox checked={selections[job.id]?.scopeIds.includes(scope.id) ?? false} onChange={(event) => updateSelection(job.id, { scopeIds: event.target.checked ? [...(selections[job.id]?.scopeIds ?? []), scope.id] : (selections[job.id]?.scopeIds ?? []).filter((id) => id !== scope.id) })} /><span><span className="block font-medium">{scope.scope_title}</span>{scope.scope_description ? <span className="block text-xs text-zinc-500">{scope.scope_description}</span> : null}</span></label>)}</div>{!job.assigned_scopes.length ? <p className="text-sm text-red-600">This quotation has no available scopes.</p> : null}</div>)}
          </CardContent>
        </Card>
      ) : null}

      {selectedJobs.length ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Combined summary</CardTitle>
            {calculations.some(
              (row) => Math.abs(row.difference) >= 0.005,
            ) ? (
              <Button
                size="sm"
                type="button"
                variant="outline"
                onClick={() =>
                  calculations.forEach(({ job, difference }) => {
                    if (Math.abs(difference) >= 0.005) {
                      updateSelection(job.id, { acknowledged: true });
                    }
                  })
                }
              >
                Acknowledge all differences
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Original Quotation Total", summary.quote],
              ["PO Before Tax", summary.beforeTax],
              ["Tax", summary.tax],
              ["PO Total", summary.total],
              ["Difference", summary.difference],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
                <p className="mt-1 font-semibold">
                  {money(Number(value), currency)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button
          disabled={
            submitting ||
            !selectedJobs.length ||
            !poNumber.trim() ||
            !poDate ||
            unacknowledged ||
            selectedJobs.some((job) => !(selections[job.id]?.scopeIds.length)) ||
            calculations.some((row) => !selections[row.job.id]?.amount)
          }
          type="submit"
        >
          {submitting ? "Creating Combined PO..." : "Create Combined PO"}
        </Button>
      </div>
    </form>
  );
}
