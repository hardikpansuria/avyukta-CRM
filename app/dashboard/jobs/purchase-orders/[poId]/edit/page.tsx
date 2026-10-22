"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, FileTextIcon, SaveIcon, UploadIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PurchaseOrder = {
  id: string;
  po_number: string;
  po_received_date: string;
  combined_po_amount_before_tax: number | string;
  internal_remarks?: string | null;
  customer?: { company_name?: string | null } | null;
  documents?: Array<{
    id: string;
    file_name?: string | null;
    document_type?: string | null;
  }>;
  allocations?: Array<{ is_currently_included?: boolean }>;
};

export default function EditPurchaseOrderPage() {
  const { poId } = useParams<{ poId: string }>();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [poAmountBeforeTax, setPoAmountBeforeTax] = useState("");
  const [internalRemarks, setInternalRemarks] = useState("");
  const [poReceivedDate, setPoReceivedDate] = useState("");
  const [document, setDocument] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          setError("You do not have permission to edit this purchase order.");
          return;
        }

        setPurchaseOrder(payload.purchase_order);
        setPoNumber(payload.purchase_order.po_number);
        setPoAmountBeforeTax(
          Number(payload.purchase_order.combined_po_amount_before_tax ?? 0).toFixed(2),
        );
        setInternalRemarks(payload.purchase_order.internal_remarks ?? "");
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

  async function save() {
    const value = poNumber.trim();
    const amount = poAmountBeforeTax.trim();
    const remarks = internalRemarks.trim();
    if (!value || !amount || !remarks || saving) {
      if (!value) setError("PO number is required.");
      else if (!amount) setError("PO Amount Before Tax is required.");
      else if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
        setError("PO Amount Before Tax must use no more than two decimal places.");
      } else if (!remarks) setError("Internal Remarks are required.");
      return;
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) {
      setError("PO Amount Before Tax must use no more than two decimal places.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("po_number", value);
      formData.set("po_amount_before_tax", amount);
      formData.set("internal_remarks", remarks);
      if (poReceivedDate) formData.set("po_received_date", poReceivedDate);
      if (document) formData.set("document", document);

      const response = await fetch(`/api/org/job-purchase-orders/${poId}`, {
        method: "PATCH",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { purchase_order?: PurchaseOrder; error?: string }
        | null;

      if (!response.ok || !payload?.purchase_order) {
        setError(payload?.error ?? "Unable to update purchase order details.");
        return;
      }

      window.location.assign(`/dashboard/jobs/purchase-orders/${poId}`);
    } catch {
      setError("Unable to update purchase order details.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-2xl">Loading purchase order...</div>;
  }

  if (!purchaseOrder) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription>{error ?? "Purchase order not found."}</AlertDescription>
        </Alert>
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />}
          variant="outline"
        >
          <ArrowLeftIcon /> Back to Purchase Order
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />}
          variant="ghost"
        >
          <ArrowLeftIcon /> Back to Purchase Order
        </Button>
        <h1 className="mt-4 text-2xl font-semibold">Edit Purchase Order</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {purchaseOrder.customer?.company_name ?? "-"} · Received {purchaseOrder.po_received_date}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Purchase Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="po-number" required>
              PO Number
            </Label>
            <Input
              autoFocus
              id="po-number"
              maxLength={120}
              required
              value={poNumber}
              onChange={(event) => setPoNumber(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-amount-before-tax" required>
              PO Amount Before Tax
            </Label>
            <Input
              id="po-amount-before-tax"
              inputMode="decimal"
              min="0"
              required
              step="0.01"
              type="number"
              value={poAmountBeforeTax}
              onChange={(event) => setPoAmountBeforeTax(event.target.value)}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tax and the job&apos;s available billing balance will be recalculated from this amount.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="internal-remarks" required>
              Internal Remarks
            </Label>
            <Textarea
              id="internal-remarks"
              maxLength={4000}
              placeholder="Explain why this purchase order is being corrected."
              required
              value={internalRemarks}
              onChange={(event) => setInternalRemarks(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-received-date">Purchase Order Received Date</Label>
            <Input
              id="po-received-date"
              type="date"
              value={poReceivedDate}
              onChange={(event) => setPoReceivedDate(event.target.value)}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Current date: {purchaseOrder.po_received_date}. Leave blank to preserve it.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="po-document">Purchase Order Document</Label>
            <label
              className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 px-4 py-5 text-center transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              htmlFor="po-document"
            >
              <UploadIcon className="mb-2 size-5 text-zinc-500" />
              <span className="text-sm font-medium">
                {document ? document.name : "Choose a replacement PO document"}
              </span>
              <span className="mt-1 text-xs text-zinc-500">
                Optional · PDF, JPG, or PNG · Maximum 15 MB
              </span>
            </label>
            <Input
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="sr-only"
              id="po-document"
              type="file"
              onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Leave empty to preserve the current documents. A newly attached file is added to the PO history.
            </p>
            {purchaseOrder.documents?.length ? (
              <div className="space-y-1 rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Current Documents
                </p>
                {purchaseOrder.documents.map((item) => (
                  <p className="flex items-center gap-2 text-sm" key={item.id}>
                    <FileTextIcon className="size-4 text-zinc-500" />
                    {item.file_name ?? "Purchase order document"}
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {(purchaseOrder.allocations?.filter((allocation) => allocation.is_currently_included).length ?? 0) > 1 ? (
            <Alert>
              <AlertDescription>
                This is a combined PO. Its number, remarks, date, and document can be corrected here. To redistribute the PO amount between jobs, use the PO Revision workflow.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={
                saving ||
                !poNumber.trim() ||
                !poAmountBeforeTax.trim() ||
                !internalRemarks.trim()
              }
              type="button"
              onClick={() => void save()}
            >
              <SaveIcon /> {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
