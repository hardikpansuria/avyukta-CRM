"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileDiffIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ChangeOrder = {
  id: string;
  change_order_number: string;
  status: "draft" | "approved" | "cancelled";
  title: string;
  reason: string;
  po_strategy: "replacement" | "supplemental";
  currency: string;
  total_amount: number | string;
  requested_date: string;
  items: Array<{
    id: string;
    description: string;
    quantity_delta: number | string;
    unit_label: string;
  }>;
};

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));
}

export function JobChangeOrders({
  jobId,
  jobStatus,
  baselineScopes,
}: {
  jobId: string;
  jobStatus: string;
  baselineScopes: Array<{ id: string; scope_title: string; quantity?: number | string | null }>;
}) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/org/jobs/${jobId}/change-orders`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (!response.ok) setError(payload?.error ?? "Unable to load Change Orders.");
        else {
          setChangeOrders(payload?.change_orders ?? []);
          setCanCreate(payload?.permissions?.can_create === true);
        }
      })
      .catch((loadError) => { if (loadError.name !== "AbortError") setError("Unable to load Change Orders."); });
    return () => controller.abort();
  }, [jobId]);

  const approvedItems = changeOrders.filter((changeOrder) => changeOrder.status === "approved").flatMap((changeOrder) =>
    changeOrder.items.map((item) => ({ ...item, changeOrderNumber: changeOrder.change_order_number })),
  );
  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-4">
      <div><CardTitle className="flex items-center gap-2"><FileDiffIcon className="size-5" />Change Orders</CardTitle><p className="mt-1 text-sm text-zinc-500">Accepted quotation scope stays unchanged. Approved changes extend this job.</p></div>
      {canCreate && ["work_in_process", "on_hold"].includes(jobStatus) ? <Button nativeButton={false} render={<Link href={`/dashboard/jobs/${jobId}/change-orders/new`} />} size="sm"><PlusIcon />Create Change Order</Button> : null}
    </CardHeader>
    <CardContent className="space-y-5">
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Baseline accepted scope</p><div className="mt-3 space-y-2">{baselineScopes.length ? baselineScopes.map((scope) => <div className="flex justify-between gap-3 text-sm" key={scope.id}><span>{scope.scope_title}</span><span className="font-medium">{Number(scope.quantity ?? 1)} units</span></div>) : <p className="text-sm text-zinc-500">No assigned baseline scope.</p>}</div></div>
        <div className="rounded-lg border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Approved scope changes</p><div className="mt-3 space-y-2">{approvedItems.length ? approvedItems.map((item) => <div className="flex justify-between gap-3 text-sm" key={item.id}><span>{item.description} <span className="text-zinc-500">({item.changeOrderNumber})</span></span><span className="font-medium">{Number(item.quantity_delta) > 0 ? "+" : ""}{Number(item.quantity_delta)} {item.unit_label}</span></div>) : <p className="text-sm text-zinc-500">No approved changes.</p>}</div></div>
      </div>
      {changeOrders.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{changeOrders.map((changeOrder) => <Link className="rounded-lg border p-4 transition hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900" href={`/dashboard/jobs/${jobId}/change-orders/${changeOrder.id}`} key={changeOrder.id}><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{changeOrder.change_order_number}</p><p className="mt-1 text-sm">{changeOrder.title}</p></div><Badge variant="outline">{changeOrder.status}</Badge></div><p className="mt-3 text-xs text-zinc-500">{changeOrder.po_strategy === "replacement" ? "Replacement PO" : "Supplemental PO"}</p><p className="mt-1 font-medium">{money(changeOrder.total_amount, changeOrder.currency)}</p></Link>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-zinc-500">No Change Orders for this job.</div>}
    </CardContent>
  </Card>;
}
