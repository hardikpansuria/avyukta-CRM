"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

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

type Allocation = {
  id: string;
  quotation_number_snapshot: string;
  project_name_snapshot?: string | null;
  quotation_total: number | string;
  po_amount_before_tax: number | string;
  tax_rate_snapshot: number | string;
  difference_acknowledged: boolean;
  is_currently_included: boolean;
  job?: { job_number?: string | null } | null;
};

type Document = {
  id: string;
  document_type: "purchase_order" | "supporting_document" | "po_revision";
  file_name: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  po_received_date: string;
  internal_remarks?: string | null;
  currency: string;
  allocations: Allocation[];
  documents: Document[];
};

type EditableAllocation = Allocation & {
  amount: string;
  acknowledged: boolean;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(value);
}

export default function EditPurchaseOrderPage() {
  const { poId } = useParams<{ poId: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [allocations, setAllocations] = useState<EditableAllocation[]>([]);
  const [replacementDocumentId, setReplacementDocumentId] = useState("");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/org/job-purchase-orders/${poId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              purchase_order?: PurchaseOrder;
              permissions?: { can_edit?: boolean };
              error?: string;
            }
          | null;
        if (!response.ok || !payload?.purchase_order) {
          setError(payload?.error ?? "Unable to load purchase order.");
          return;
        }
        if (!payload.permissions?.can_edit) {
          setError("You do not have permission to edit purchase orders.");
          return;
        }
        const purchaseOrder = payload.purchase_order;
        const currentAllocations = purchaseOrder.allocations.filter(
          (allocation) => allocation.is_currently_included,
        );
        if (!currentAllocations.length) {
          setError("This purchase order is no longer attached to a quotation.");
          return;
        }
        setPo(purchaseOrder);
        setPoNumber(purchaseOrder.po_number);
        setReceivedDate(purchaseOrder.po_received_date);
        setRemarks(purchaseOrder.internal_remarks ?? "");
        setAllocations(currentAllocations.map((allocation) => ({
          ...allocation,
          amount: String(allocation.po_amount_before_tax),
          acknowledged: allocation.difference_acknowledged,
        })));
        const replaceable = purchaseOrder.documents.find(
          (document) => document.document_type === "purchase_order",
        ) ?? purchaseOrder.documents.find(
          (document) => document.document_type === "supporting_document",
        );
        setReplacementDocumentId(replaceable?.id ?? "");
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load purchase order.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [poId]);

  const replaceableDocuments = po?.documents.filter(
    (document) => document.document_type !== "po_revision",
  ) ?? [];

  function updateAllocation(
    id: string,
    values: Partial<Pick<EditableAllocation, "amount" | "acknowledged">>,
  ) {
    setAllocations((current) => current.map((allocation) =>
      allocation.id === id ? { ...allocation, ...values } : allocation,
    ));
  }

  async function save() {
    if (!po || saving) return;
    setError(null);
    if (!poNumber.trim()) {
      setError("Purchase Order Number is required.");
      return;
    }
    if (!receivedDate) {
      setError("Purchase Order Received Date is required.");
      return;
    }
    if (replacementFile && !replacementDocumentId) {
      setError("Select the existing document that should be replaced.");
      return;
    }
    if (allocations.some((allocation) => {
      const amount = Number(allocation.amount);
      const total = amount + amount * Number(allocation.tax_rate_snapshot) / 100;
      const differs = Math.abs(total - Number(allocation.quotation_total)) >= 0.005;
      return !Number.isFinite(amount) || amount < 0 || (differs && !allocation.acknowledged);
    })) {
      setError("Enter valid amounts and acknowledge every difference from its quotation total.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/org/job-purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          po_number: poNumber.trim(),
          po_received_date: receivedDate,
          internal_remarks: remarks.trim() || null,
          allocations: allocations.map((allocation) => ({
            allocation_id: allocation.id,
            po_amount_before_tax: Number(allocation.amount),
            difference_acknowledged: allocation.acknowledged,
          })),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to save purchase order changes.");
        return;
      }

      let warning = "";
      if (replacementFile && replacementDocumentId) {
        const formData = new FormData();
        formData.set("file", replacementFile);
        const documentResponse = await fetch(
          `/api/org/job-purchase-orders/${poId}/documents/${replacementDocumentId}`,
          { method: "PATCH", body: formData },
        );
        const documentPayload = (await documentResponse.json().catch(() => null)) as
          | { error?: string; warning?: string | null }
          | null;
        if (!documentResponse.ok) {
          warning = ` PO details were saved, but the attachment was not replaced: ${documentPayload?.error ?? "unknown error"}`;
        } else if (documentPayload?.warning) {
          warning = ` ${documentPayload.warning}`;
        }
      }

      window.location.assign(
        `/dashboard/jobs/purchase-orders/${poId}?message=${encodeURIComponent(`Purchase Order changes saved.${warning}`)}`,
      );
    } catch {
      setError("Unable to save purchase order changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-5xl">Loading PO...</div>;
  if (!po) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Alert variant="destructive"><AlertDescription>{error ?? "Purchase order not found."}</AlertDescription></Alert>
        <Button nativeButton={false} render={<Link href="/dashboard/jobs/purchase-orders" />} variant="outline">Back</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold">Edit Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-500">Correct the existing PO record without creating a duplicate.</p>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle>Purchase Order Details</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="po-number" required>PO Number</Label>
            <Input id="po-number" required value={poNumber} onChange={(event) => setPoNumber(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-date" required>PO Received Date</Label>
            <Input id="po-date" required type="date" value={receivedDate} onChange={(event) => setReceivedDate(event.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="po-remarks">PO Notes / Additional Remarks</Label>
            <Textarea id="po-remarks" className="min-h-28" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>PO Amounts</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {allocations.map((allocation) => {
            const amount = Number(allocation.amount || 0);
            const total = amount + amount * Number(allocation.tax_rate_snapshot) / 100;
            const difference = total - Number(allocation.quotation_total);
            return (
              <div className="rounded-xl border p-4" key={allocation.id}>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">Quotation {allocation.quotation_number_snapshot}</p>
                    <p className="text-sm text-zinc-500">{allocation.job?.job_number ?? "Pending job number"} · {allocation.project_name_snapshot ?? "No project name"}</p>
                  </div>
                  <p className="text-sm text-zinc-500">Quotation total: {money(Number(allocation.quotation_total), po.currency)}</p>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`amount-${allocation.id}`} required>Amount Before Tax</Label>
                    <Input id={`amount-${allocation.id}`} inputMode="decimal" min="0" required step="0.01" type="number" value={allocation.amount} onChange={(event) => updateAllocation(allocation.id, { amount: event.target.value })} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Tax ({Number(allocation.tax_rate_snapshot)}%)</p>
                    <p className="mt-3 text-sm">{money(total - amount, po.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">PO Total</p>
                    <p className="mt-3 text-sm">{money(total, po.currency)}</p>
                  </div>
                </div>
                {Math.abs(difference) >= 0.005 ? (
                  <label className="mt-4 flex items-start gap-2 text-sm">
                    <Checkbox checked={allocation.acknowledged} onChange={(event) => updateAllocation(allocation.id, { acknowledged: event.target.checked })} />
                    <span>I acknowledge the {money(difference, po.currency)} difference from the quotation total.</span>
                  </label>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Replace Attached Document</CardTitle></CardHeader>
        <CardContent className="grid items-end gap-4 sm:grid-cols-2">
          {replaceableDocuments.length ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="replacement-document">Document to Replace</Label>
                <Select value={replacementDocumentId} onValueChange={(value) => setReplacementDocumentId(String(value))}>
                  <SelectTrigger id="replacement-document"><SelectValue placeholder="Select a document" /></SelectTrigger>
                  <SelectContent>
                    {replaceableDocuments.map((document) => (
                      <SelectItem key={document.id} value={document.id}>{document.file_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="replacement-file">New File</Label>
                <Input id="replacement-file" type="file" accept={replaceableDocuments.find((document) => document.id === replacementDocumentId)?.document_type === "purchase_order" ? ".pdf,application/pdf" : ".pdf,.jpg,.jpeg,.png,.docx,.xlsx"} onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)} />
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500 sm:col-span-2">No existing document is available to replace. Add a document from the PO detail page.</p>
          )}
          <p className="text-xs text-zinc-500 sm:col-span-2">Leave the file empty to keep the current attachment. Original PO replacements must be PDF; supporting files may be PDF, JPEG, PNG, DOCX, or XLSX up to 15 MB.</p>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button disabled={saving} nativeButton={false} render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />} variant="outline">Cancel</Button>
        <Button disabled={saving} type="button" onClick={() => void save()}>{saving ? "Saving..." : "Save Changes"}</Button>
      </div>
    </div>
  );
}
