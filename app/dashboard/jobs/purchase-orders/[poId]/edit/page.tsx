"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PurchaseOrder = {
  id: string;
  po_number: string;
  po_received_date: string;
  customer?: { company_name?: string | null } | null;
};

export default function EditPurchaseOrderPage() {
  const { poId } = useParams<{ poId: string }>();
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [poNumber, setPoNumber] = useState("");
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
    if (!value || saving) {
      if (!value) setError("PO number is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/org/job-purchase-orders/${poId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_number: value }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { purchase_order?: PurchaseOrder; error?: string }
        | null;

      if (!response.ok || !payload?.purchase_order) {
        setError(payload?.error ?? "Unable to update purchase order number.");
        return;
      }

      window.location.assign(`/dashboard/jobs/purchase-orders/${poId}`);
    } catch {
      setError("Unable to update purchase order number.");
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
        <h1 className="mt-4 text-2xl font-semibold">Edit PO Number</h1>
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
          <p className="text-sm text-zinc-500">
            This corrects the number on the existing purchase order. It does not
            create another PO or change its job allocations, amount, or documents.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              nativeButton={false}
              render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={saving || !poNumber.trim()}
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
