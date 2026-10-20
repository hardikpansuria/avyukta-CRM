"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon, SaveIcon, XCircleIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ChangeItem = { id?: string; description: string; quantity_delta: number | string; unit_label: string; unit_price: number | string; line_total?: number | string };
type ChangeOrder = {
  id: string; change_order_number: string; status: "draft" | "approved" | "cancelled";
  title: string; reason: string; description?: string | null; requested_date: string;
  po_strategy: "replacement" | "supplemental"; currency: string; subtotal: number | string;
  tax_name?: string | null; tax_rate: number | string; tax_amount: number | string; total_amount: number | string;
  cancellation_reason?: string | null; items: ChangeItem[];
  purchase_orders: Array<{ id: string; relationship_type: string; job_purchase_orders?: { id: string; po_number: string; po_received_date: string; current_po_total: number | string } }>;
  activity: Array<{ id: string; action: string; created_at: string; notes?: string | null }>;
};
type Job = { job_number?: string | null; job_status: string; purchase_orders: Array<{ id: string; po_number: string; allocation: { id: string; total_po_amount: number | string } }> };
type Permissions = { can_edit?: boolean; can_approve?: boolean; can_cancel?: boolean };

function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));
}

export default function ChangeOrderDetailPage() {
  const { jobId, changeOrderId } = useParams<{ jobId: string; changeOrderId: string }>();
  const [changeOrder, setChangeOrder] = useState<ChangeOrder | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [poAmount, setPoAmount] = useState("");
  const [replacedAllocationId, setReplacedAllocationId] = useState("");
  const [poDocument, setPoDocument] = useState<File | null>(null);

  const load = useCallback(async () => {
    const [jobResponse, changesResponse] = await Promise.all([
      fetch(`/api/org/jobs/${jobId}`, { cache: "no-store" }),
      fetch(`/api/org/jobs/${jobId}/change-orders`, { cache: "no-store" }),
    ]);
    const [jobPayload, changesPayload] = await Promise.all([jobResponse.json().catch(() => null), changesResponse.json().catch(() => null)]);
    if (!jobResponse.ok || !jobPayload?.job) return setError(jobPayload?.error ?? "Unable to load job.");
    if (!changesResponse.ok) return setError(changesPayload?.error ?? "Unable to load Change Order.");
    const found = (changesPayload?.change_orders ?? []).find((row: ChangeOrder) => row.id === changeOrderId);
    if (!found) return setError("Change Order not found.");
    setJob(jobPayload.job); setChangeOrder(found); setPermissions(changesPayload.permissions ?? {}); setError(null);
    setPoAmount(String(found.po_strategy === "supplemental" ? Number(found.subtotal) : ""));
  }, [changeOrderId, jobId]);
  useEffect(() => { void load(); }, [load]);

  function updateField(key: keyof ChangeOrder, value: string) {
    setChangeOrder((current) => current ? { ...current, [key]: value } : current);
  }
  function updateItem(index: number, key: keyof ChangeItem, value: string) {
    setChangeOrder((current) => current ? { ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) } : current);
  }
  async function save() {
    if (!changeOrder || saving) return;
    setSaving(true); setError(null); setMessage(null);
    const response = await fetch(`/api/org/jobs/${jobId}/change-orders/${changeOrder.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changeOrder) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.error ?? "Unable to save Change Order.");
    else { setMessage("Draft Change Order saved."); await load(); }
    setSaving(false);
  }
  async function approve(event: FormEvent) {
    event.preventDefault();
    if (!changeOrder || !poDocument || saving) return;
    setSaving(true); setError(null);
    const form = new FormData();
    form.set("po_number", poNumber); form.set("po_received_date", poDate); form.set("po_amount_before_tax", poAmount); form.set("replaced_allocation_id", replacedAllocationId); form.set("po_document", poDocument);
    const response = await fetch(`/api/org/jobs/${jobId}/change-orders/${changeOrder.id}/approve`, { method: "POST", body: form });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.error ?? "Unable to approve Change Order.");
    else { setApproveOpen(false); setMessage(`${changeOrder.change_order_number} approved and applied to the job.`); await load(); }
    setSaving(false);
  }
  async function cancelChangeOrder() {
    if (!changeOrder || !cancelReason.trim() || saving) return;
    setSaving(true); setError(null);
    const response = await fetch(`/api/org/jobs/${jobId}/change-orders/${changeOrder.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: cancelReason }) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) setError(payload?.error ?? "Unable to cancel Change Order.");
    else { setCancelOpen(false); setCancelReason(""); setMessage(`${changeOrder.change_order_number} cancelled.`); await load(); }
    setSaving(false);
  }
  if (!changeOrder || !job) return <div className="mx-auto max-w-5xl">{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : "Loading Change Order…"}</div>;
  const editable = changeOrder.status === "draft" && permissions.can_edit;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Button nativeButton={false} render={<Link href={`/dashboard/jobs/${jobId}`} />} variant="ghost"><ArrowLeftIcon />Back to {job.job_number ?? "Job"}</Button>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-semibold">{changeOrder.change_order_number}</h1><Badge variant="outline">{changeOrder.status}</Badge></div><p className="mt-1 text-sm text-zinc-500">Post-acceptance change for {job.job_number ?? "this job"}</p></div><div className="flex flex-wrap gap-2">{editable ? <Button onClick={save} disabled={saving}><SaveIcon />Save Changes</Button> : null}{changeOrder.status === "draft" && permissions.can_approve ? <Button onClick={() => setApproveOpen(true)}><CheckCircle2Icon />Approve & Attach PO</Button> : null}{changeOrder.status !== "cancelled" && permissions.can_cancel ? <Button variant="outline" onClick={() => setCancelOpen(true)}><XCircleIcon />Cancel Change Order</Button> : null}</div></div>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}{message ? <Alert><AlertDescription>{message}</AlertDescription></Alert> : null}
    <Card><CardHeader><CardTitle>Change details</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label>Title</Label><Input disabled={!editable} value={changeOrder.title} onChange={(event) => updateField("title", event.target.value)} /></div><div className="space-y-2"><Label>Requested Date</Label><Input disabled={!editable} type="date" value={changeOrder.requested_date} onChange={(event) => updateField("requested_date", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Reason</Label><Input disabled={!editable} value={changeOrder.reason} onChange={(event) => updateField("reason", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label>Remarks</Label><Textarea disabled={!editable} value={changeOrder.description ?? ""} onChange={(event) => updateField("description", event.target.value)} /></div><div className="space-y-2"><Label>PO Method</Label><Select disabled={!editable} value={changeOrder.po_strategy} onValueChange={(value) => updateField("po_strategy", String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supplemental">Supplemental PO</SelectItem><SelectItem value="replacement">Replacement PO</SelectItem></SelectContent></Select></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Scope changes</CardTitle></CardHeader><CardContent className="space-y-3">{changeOrder.items.map((item, index) => <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-4" key={item.id ?? index}><div className="space-y-2 sm:col-span-2"><Label>Description</Label><Input disabled={!editable} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></div><div className="space-y-2"><Label>Quantity change</Label><Input disabled={!editable} step="0.0001" type="number" value={item.quantity_delta} onChange={(event) => updateItem(index, "quantity_delta", event.target.value)} /></div><div className="space-y-2"><Label>Unit price</Label><Input disabled={!editable} min="0" step="0.01" type="number" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} /></div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Commercial and PO history</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 sm:grid-cols-4"><div><p className="text-xs uppercase text-zinc-500">Subtotal</p><p className="font-semibold">{money(changeOrder.subtotal, changeOrder.currency)}</p></div><div><p className="text-xs uppercase text-zinc-500">Tax</p><p className="font-semibold">{money(changeOrder.tax_amount, changeOrder.currency)}</p></div><div><p className="text-xs uppercase text-zinc-500">Total</p><p className="font-semibold">{money(changeOrder.total_amount, changeOrder.currency)}</p></div><div><p className="text-xs uppercase text-zinc-500">Method</p><p className="font-semibold capitalize">{changeOrder.po_strategy}</p></div></div>{changeOrder.purchase_orders.map((link) => <div className="rounded-lg border p-4" key={link.id}><Link className="font-medium hover:underline" href={`/dashboard/jobs/purchase-orders/${link.job_purchase_orders?.id}`}>{link.job_purchase_orders?.po_number ?? "Purchase Order"}</Link><p className="mt-1 text-xs text-zinc-500">{link.relationship_type} · {link.job_purchase_orders?.po_received_date}</p></div>)}{changeOrder.cancellation_reason ? <Alert><AlertDescription>Cancelled: {changeOrder.cancellation_reason}</AlertDescription></Alert> : null}</CardContent></Card>
    <Card><CardHeader><CardTitle>Audit history</CardTitle></CardHeader><CardContent className="space-y-3">{changeOrder.activity.map((activity) => <div className="flex flex-col justify-between gap-1 border-b pb-3 text-sm last:border-0 sm:flex-row" key={activity.id}><span className="capitalize">{activity.action}{activity.notes ? ` · ${activity.notes}` : ""}</span><time className="text-zinc-500">{new Date(activity.created_at).toLocaleString("en-CA")}</time></div>)}</CardContent></Card>
    <Dialog open={approveOpen} onOpenChange={setApproveOpen}><DialogContent><form className="space-y-5" onSubmit={approve}><DialogHeader><DialogTitle>Approve {changeOrder.change_order_number}</DialogTitle><DialogDescription>This applies the approved scope to the same job and permanently links the new PO.</DialogDescription></DialogHeader><div className="space-y-2"><Label required>PO Number</Label><Input required value={poNumber} onChange={(event) => setPoNumber(event.target.value)} /></div><div className="space-y-2"><Label required>PO Received Date</Label><Input required type="date" value={poDate} onChange={(event) => setPoDate(event.target.value)} /></div><div className="space-y-2"><Label required>PO Amount Before Tax</Label><Input min="0" required step="0.01" type="number" value={poAmount} onChange={(event) => setPoAmount(event.target.value)} /></div>{changeOrder.po_strategy === "replacement" ? <div className="space-y-2"><Label required>Active PO being replaced</Label><Select value={replacedAllocationId} onValueChange={(value) => setReplacedAllocationId(String(value))}><SelectTrigger className="w-full"><SelectValue placeholder="Select active PO" /></SelectTrigger><SelectContent>{job.purchase_orders.map((po) => <SelectItem key={po.allocation.id} value={po.allocation.id}>{po.po_number} · {money(po.allocation.total_po_amount, changeOrder.currency)}</SelectItem>)}</SelectContent></Select></div> : null}<div className="space-y-2"><Label required>PO PDF</Label><Input accept="application/pdf,.pdf" required type="file" onChange={(event) => setPoDocument(event.target.files?.[0] ?? null)} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>Cancel</Button><Button disabled={saving || !poDocument || (changeOrder.po_strategy === "replacement" && !replacedAllocationId)} type="submit">Approve Change Order</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent><DialogHeader><DialogTitle>Cancel {changeOrder.change_order_number}?</DialogTitle><DialogDescription>The record and audit history remain. Approved changes can be cancelled only before billing or completion.</DialogDescription></DialogHeader><div className="space-y-2"><Label required>Cancellation reason</Label><Textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setCancelOpen(false)}>Keep Change Order</Button><Button disabled={saving || !cancelReason.trim()} variant="destructive" onClick={cancelChangeOrder}>Cancel Change Order</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
