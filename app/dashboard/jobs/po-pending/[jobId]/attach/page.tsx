"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  PaperclipIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label, RequiredMark } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { JobListItem } from "@/lib/jobs/types";
import { PoDuplicateDialog } from "../../po-duplicate-dialog";

type CreateResult = {
  purchase_order_id?: string;
  po_number?: string;
  jobs?: Array<{ id: string; job_number?: string | null }>;
  document_warning?: string | null;
  error?: string;
  code?: string;
  existing_purchase_order?: { id: string; po_number: string };
};

function amount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value);
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

export default function AttachPurchaseOrderPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobListItem | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState("");
  const [poAmount, setPoAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [poPdf, setPoPdf] = useState<File | null>(null);
  const [supporting, setSupporting] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingPo, setExistingPo] = useState<{ id: string; po_number: string } | null>(null);

  async function checkDuplicate() {
    if (!job?.customer_id || !poNumber.trim()) return;
    const params = new URLSearchParams({
      customer_id: job.customer_id,
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
        const response = await fetch(`/api/org/jobs/${jobId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { job?: JobListItem; error?: string }
          | null;
        if (!response.ok || !payload?.job) {
          setError(payload?.error ?? "Unable to load job.");
          return;
        }
        if (payload.job.job_status !== "po_pending") {
          setError("This job is no longer PO Pending.");
          return;
        }
        setJob(payload.job);
        setScopeIds(payload.job.assigned_scopes.map((scope) => scope.id));
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
  }, [jobId]);

  const currency = job?.customer?.currency ?? "CAD";
  const quotationTotal = Number(
    job?.quotation?.grand_total_after_tax ??
      job?.quotation?.grand_total_before_tax ??
      0,
  );
  const taxRate = Number(job?.quotation?.tax_rate ?? 0);
  const poBeforeTax = amount(poAmount);
  const taxAmount = poBeforeTax * (taxRate / 100);
  const poTotal = poBeforeTax + taxAmount;
  const difference = poTotal - quotationTotal;
  const differs = Math.abs(difference) >= 0.005;
  const differenceText = useMemo(() => {
    if (!differs) return "PO total matches the accepted quotation.";
    return `PO is ${money(Math.abs(difference), currency)} ${
      difference < 0 ? "below" : "above"
    } quotation.`;
  }, [currency, difference, differs]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!job || submitting || (differs && !acknowledged)) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("po_number", poNumber);
    form.set("po_received_date", poDate);
    form.set("internal_remarks", remarks);
    form.set(
      "allocations",
      JSON.stringify([
        {
          job_id: job.id,
          po_amount_before_tax: poBeforeTax,
          difference_acknowledged: acknowledged,
          scope_ids: scopeIds,
        },
      ]),
    );
    if (poPdf) form.set("po_pdf", poPdf);
    supporting.forEach((file) => form.append("supporting_documents", file));

    try {
      const response = await fetch("/api/org/job-purchase-orders", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as
        | CreateResult
        | null;
      if (!response.ok || !payload?.purchase_order_id) {
        if (payload?.code === "PO_EXISTS" && payload.existing_purchase_order) {
          setExistingPo(payload.existing_purchase_order);
          return;
        }
        setError(payload?.error ?? "Unable to create purchase order.");
        return;
      }
      setResult(payload);
      router.refresh();
    } catch {
      setError("Unable to create purchase order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl p-8 text-sm">Loading job...</div>;
  }

  if (result?.purchase_order_id) {
    const jobNumber =
      result.jobs?.find((item) => item.id === jobId)?.job_number ?? "-";
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="py-10 text-center">
            <CheckCircle2Icon className="mx-auto size-12 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-semibold">
              Purchase Order received
            </h1>
            <p className="mt-2 text-zinc-500">
              PO No: {result.po_number} created Job Number{" "}
              <strong className="text-zinc-950 dark:text-zinc-50">
                {jobNumber}
              </strong>
              .
            </p>
            {result.document_warning ? (
              <Alert className="mt-6 text-left">
                <AlertTriangleIcon />
                <AlertTitle>Document upload needs attention</AlertTitle>
                <AlertDescription>{result.document_warning}</AlertDescription>
              </Alert>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/dashboard/jobs/purchase-orders/${result.purchase_order_id}`}
                  />
                }
              >
                View Purchase Order
              </Button>
              <Button
                nativeButton={false}
                render={<Link href="/dashboard/jobs/po-pending" />}
                variant="outline"
              >
                Back to PO Pending
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PoDuplicateDialog
        existingPo={existingPo}
        jobIds={[jobId]}
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
        <h1 className="text-2xl font-semibold">Attach Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-500">
          The accepted quotation values are read-only. The server RPC verifies
          and calculates the final allocation.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangleIcon />
          <AlertTitle>Unable to continue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {job ? (
        <form className="grid gap-6 lg:grid-cols-[1fr_360px]" onSubmit={submit}>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Accepted quotation</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <ReadOnlyField
                  label="Quotation Number"
                  value={job.quotation?.quotation_number ?? "-"}
                />
                <ReadOnlyField
                  label="Revision Number"
                  value={String(job.quotation?.revision_number ?? 0)}
                />
                <ReadOnlyField
                  label="Customer"
                  value={job.customer?.company_name ?? "-"}
                />
                <ReadOnlyField
                  label="Project"
                  value={job.quotation?.project_name ?? "-"}
                />
                <ReadOnlyField
                  label="Quotation Grand Total"
                  value={money(quotationTotal, currency)}
                />
                <ReadOnlyField
                  label="Tax"
                  value={`${job.quotation?.tax_name ?? "Tax"} · ${taxRate}%`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Work Order Scope <RequiredMark /></CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-zinc-500">Select only the quotation scope(s) covered by this Work Order. The completion acknowledgement will use this exact selection.</p>
                {job.assigned_scopes.map((scope) => (
                  <label className="flex items-start gap-3 rounded-lg border p-3" key={scope.id}>
                    <Checkbox checked={scopeIds.includes(scope.id)} onChange={(event) => setScopeIds((current) => event.target.checked ? [...current, scope.id] : current.filter((id) => id !== scope.id))} />
                    <span><span className="block text-sm font-medium">{scope.scope_title}</span>{scope.scope_description ? <span className="mt-1 block text-xs text-zinc-500">{scope.scope_description}</span> : null}</span>
                  </label>
                ))}
                {!job.assigned_scopes.length ? <Alert variant="destructive"><AlertDescription>This quotation has no scopes available for the Work Order.</AlertDescription></Alert> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Purchase Order</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="po-number" required>Purchase Order Number</Label>
                  <Input
                    id="po-number"
                    required
              value={poNumber}
              onBlur={() => void checkDuplicate()}
                    onChange={(event) => setPoNumber(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="po-date" required>Purchase Order Received Date</Label>
                  <Input
                    id="po-date"
                    required
                    type="date"
                    value={poDate}
                    onChange={(event) => setPoDate(event.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="po-amount" required>PO Amount Before Tax</Label>
                  <Input
                    id="po-amount"
                    min="0"
                    required
                    step="0.01"
                    type="number"
                    value={poAmount}
                    onChange={(event) => {
                      setPoAmount(event.target.value);
                      setAcknowledged(false);
                    }}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="remarks">Internal Remarks</Label>
                  <Textarea
                    id="remarks"
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="po-pdf">PO PDF</Label>
                  <Input
                    accept="application/pdf"
                    id="po-pdf"
                    type="file"
                    onChange={(event) =>
                      setPoPdf(event.target.files?.[0] ?? null)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="supporting">Supporting Documents</Label>
                  <Input
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    id="supporting"
                    multiple
                    type="file"
                    onChange={(event) =>
                      setSupporting(Array.from(event.target.files ?? []))
                    }
                  />
                </div>
                <p className="flex items-center gap-2 text-xs text-zinc-500 sm:col-span-2">
                  <PaperclipIcon className="size-3.5" />
                  PDF, JPEG, PNG, or WebP. Maximum 15 MB per document.
                </p>
              </CardContent>
            </Card>
          </div>

          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Allocation summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">PO before tax</span>
                  <span>{money(poBeforeTax, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">
                    {job.quotation?.tax_name ?? "Tax"} ({taxRate}%)
                  </span>
                  <span>{money(taxAmount, currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-3 font-semibold">
                  <span>PO total</span>
                  <span>{money(poTotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-500">Quotation total</span>
                  <span>{money(quotationTotal, currency)}</span>
                </div>
                <div
                  className={`rounded-2xl border p-3 text-sm ${
                    differs
                      ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                      : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
                  }`}
                >
                  {differenceText}
                </div>
                {differs ? (
                  <label className="flex items-start gap-3 rounded-2xl border p-3 text-sm">
                    <Checkbox
                      checked={acknowledged}
                      onChange={(event) =>
                        setAcknowledged(event.target.checked)
                      }
                    />
                    <span>
                      I acknowledge that the Purchase Order total differs from
                      the accepted quotation total.
                    </span>
                  </label>
                ) : null}
                <Button
                  className="w-full"
                  disabled={
                    submitting ||
                    !poNumber.trim() ||
                    !poDate ||
                    !poAmount ||
                    !scopeIds.length ||
                    (differs && !acknowledged)
                  }
                  type="submit"
                >
                  {submitting ? "Creating..." : "Create Purchase Order"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </form>
      ) : null}
    </div>
  );
}
