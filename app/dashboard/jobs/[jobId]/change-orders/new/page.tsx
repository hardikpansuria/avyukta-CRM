"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Item = { description: string; quantity_delta: string; unit_label: string; unit_price: string };
const blankItem = (): Item => ({ description: "", quantity_delta: "1", unit_label: "unit", unit_price: "0" });

export default function NewChangeOrderPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().slice(0, 10));
  const [strategy, setStrategy] = useState("supplemental");
  const [taxName, setTaxName] = useState("HST");
  const [taxRate, setTaxRate] = useState("13");
  const [currency, setCurrency] = useState("CAD");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [jobLabel, setJobLabel] = useState("Job");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/org/jobs/${jobId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (!response.ok || !payload?.job) setError(payload?.error ?? "Unable to load job.");
        else {
          setJobLabel(payload.job.job_number ?? "Job");
          setCurrency(payload.job.customer?.currency ?? "CAD");
          setTaxName(payload.job.quotation?.tax_name ?? "HST");
          setTaxRate(String(payload.job.quotation?.tax_rate ?? 13));
        }
      })
      .catch((loadError) => { if (loadError.name !== "AbortError") setError("Unable to load job."); });
    return () => controller.abort();
  }, [jobId]);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity_delta || 0) * Number(item.unit_price || 0), 0), [items]);
  const total = subtotal + subtotal * Number(taxRate || 0) / 100;
  function updateItem(index: number, key: keyof Item, value: string) {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true); setError(null);
    const response = await fetch(`/api/org/jobs/${jobId}/change-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, reason, description, requested_date: requestedDate, po_strategy: strategy, currency, tax_name: taxName, tax_rate: Number(taxRate), items: items.map((item, index) => ({ ...item, quantity_delta: Number(item.quantity_delta), unit_price: Number(item.unit_price), sort_order: index })) }),
    });
    const payload = await response.json().catch(() => null) as { id?: string; error?: string } | null;
    if (!response.ok || !payload?.id) setError(payload?.error ?? "Unable to create Change Order.");
    else router.push(`/dashboard/jobs/${jobId}/change-orders/${payload.id}`);
    setSubmitting(false);
  }
  return <form className="mx-auto max-w-5xl space-y-6" onSubmit={submit}>
    <Button nativeButton={false} render={<Link href={`/dashboard/jobs/${jobId}`} />} variant="ghost"><ArrowLeftIcon />Back to {jobLabel}</Button>
    <div><h1 className="text-2xl font-semibold">Create Change Order</h1><p className="mt-1 text-sm text-zinc-500">The accepted quotation remains unchanged. This draft records only the added or reduced scope.</p></div>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <Card><CardHeader><CardTitle>Change details</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="co-title" required>Title</Label><Input id="co-title" required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add two tanks" /></div>
      <div className="space-y-2"><Label htmlFor="co-date" required>Requested Date</Label><Input id="co-date" required type="date" value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="co-reason" required>Reason</Label><Input id="co-reason" required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Customer requested additional production" /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="co-description">Additional Remarks</Label><Textarea id="co-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
      <div className="space-y-2"><Label required>PO Method</Label><Select value={strategy} onValueChange={(value) => setStrategy(String(value))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supplemental">Supplemental PO</SelectItem><SelectItem value="replacement">Replacement PO</SelectItem></SelectContent></Select><p className="text-xs text-zinc-500">Supplemental adds to existing PO value. Replacement supersedes one active PO.</p></div>
    </CardContent></Card>
    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Scope changes</CardTitle><Button type="button" size="sm" variant="outline" onClick={() => setItems((current) => [...current, blankItem()])}><PlusIcon />Add item</Button></CardHeader><CardContent className="space-y-4">{items.map((item, index) => <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-12" key={index}><div className="space-y-2 sm:col-span-5"><Label required>Description</Label><Input required value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder="Stainless steel tank" /></div><div className="space-y-2 sm:col-span-2"><Label required>Quantity change</Label><Input required step="0.0001" type="number" value={item.quantity_delta} onChange={(event) => updateItem(index, "quantity_delta", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label required>Unit</Label><Input required value={item.unit_label} onChange={(event) => updateItem(index, "unit_label", event.target.value)} /></div><div className="space-y-2 sm:col-span-2"><Label required>Unit price</Label><Input min="0" required step="0.01" type="number" value={item.unit_price} onChange={(event) => updateItem(index, "unit_price", event.target.value)} /></div><div className="flex items-end sm:col-span-1"><Button aria-label="Remove item" disabled={items.length === 1} type="button" size="icon" variant="ghost" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2Icon /></Button></div></div>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>Commercial summary</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-3"><div className="space-y-2"><Label>Tax Name</Label><Input value={taxName} onChange={(event) => setTaxName(event.target.value)} /></div><div className="space-y-2"><Label>Tax Rate (%)</Label><Input min="0" step="0.001" type="number" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} /></div><div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900"><p className="text-xs uppercase text-zinc-500">Change total</p><p className="mt-2 text-xl font-semibold">{new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(total)}</p></div></CardContent></Card>
    <div className="flex justify-end gap-2"><Button nativeButton={false} render={<Link href={`/dashboard/jobs/${jobId}`} />} variant="outline">Cancel</Button><Button disabled={submitting} type="submit">{submitting ? "Saving…" : "Save Draft"}</Button></div>
  </form>;
}
