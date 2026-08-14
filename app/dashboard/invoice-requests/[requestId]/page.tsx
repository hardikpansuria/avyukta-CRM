"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, CalendarClockIcon, DownloadIcon, FileUpIcon, Trash2Icon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type RequestDetail = {
  id: string;
  request_number: number | string;
  invoice_type: string;
  amount_type: string;
  amount_value: number | string;
  requested_amount: number | string;
  billing_description: string;
  items_to_include: string[];
  comments_for_accounts?: string | null;
  status: string;
  currency: string;
  job_id: string;
  job_number_snapshot?: string | null;
  po_number_snapshot: string;
  po_received_date_snapshot: string;
  customer_name_snapshot: string;
  project_name_snapshot?: string | null;
  quotation_number_snapshot: string;
  revision_number_snapshot: number;
  salesperson_snapshot?: string | null;
  customer_contact_snapshot?: string | null;
  po_total_snapshot: number | string;
  payment_terms_snapshot?: string | null;
  customer_tax_snapshot?: string | null;
  customer_address_snapshot?: string | null;
  billing_address_snapshot?: string | null;
  shipping_address_snapshot?: string | null;
  requester?: { full_name?: string | null; email?: string | null } | null;
  invoice?: { id: string; invoice_number: string; status: string } | null;
  documents: Array<{ id: string; file_name: string; signed_url?: string | null }>;
  purchase_order_documents: Array<{
    id: string;
    file_name: string;
    document_type: string;
    signed_url?: string | null;
  }>;
  status_history: Array<{
    id: string;
    previous_status?: string | null;
    new_status: string;
    changed_at: string;
    actor?: { full_name?: string | null; email?: string | null } | null;
  }>;
};
type Permissions = {
  can_edit: boolean;
  can_process: boolean;
  can_archive: boolean;
  can_reopen: boolean;
  can_delete: boolean;
  can_create_invoice: boolean;
};

const itemLabels: Record<string, string> = {
  tank_fabrication: "Tank fabrication",
  installation: "Installation",
  passivation: "Passivation",
  freight: "Freight",
  engineering: "Engineering",
  material_supplied: "Material supplied",
  change_order: "Change Order",
};
function title(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}
function money(value: number | string, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(Number(value));
}

export default function InvoiceRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [permissions, setPermissions] = useState<Permissions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [comments, setComments] = useState("");
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/org/invoice-requests/${requestId}`, { cache: "no-store", signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { request?: RequestDetail; permissions?: Permissions; error?: string } | null;
        if (!response.ok || !payload?.request) setError(payload?.error ?? "Unable to load invoice request.");
        else {
          setDetail(payload.request);
          setPermissions(payload.permissions ?? null);
          setDescription(payload.request.billing_description);
          setComments(payload.request.comments_for_accounts ?? "");
          setItems(payload.request.items_to_include ?? []);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) setError("Unable to load invoice request.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [requestId, refresh]);

  async function patch(body: Record<string, unknown>) {
    if (updating) return false;
    setUpdating(true);
    const response = await fetch(`/api/org/invoice-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setError(payload?.error ?? "Unable to update request.");
    else {
      setEditing(false);
      setRefresh((value) => value + 1);
    }
    setUpdating(false);
    return response.ok;
  }

  async function remove() {
    if (!window.confirm("Permanently delete this invoice request and its supporting files?")) return;
    setUpdating(true);
    const response = await fetch(`/api/org/invoice-requests/${requestId}`, { method: "DELETE" });
    if (response.ok) router.push("/dashboard/invoice-requests");
    else {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Unable to delete request.");
      setUpdating(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl">Loading invoice request...</div>;
  if (!detail) return <Alert><AlertDescription>{error ?? "Invoice request not found."}</AlertDescription></Alert>;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button nativeButton={false} render={<Link href="/dashboard/invoice-requests" />} variant="ghost"><ArrowLeftIcon />Back to Requests</Button>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div><p className="text-sm text-zinc-500">Invoice Request</p><h1 className="text-2xl font-semibold">IR-{String(detail.request_number).padStart(3, "0")}</h1><p className="mt-1 text-sm text-zinc-500">{detail.customer_name_snapshot} · Job {detail.job_number_snapshot ?? "-"}</p></div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{title(detail.status)}</Badge>
          {permissions?.can_edit ? <Button onClick={() => setEditing((value) => !value)} variant="outline">{editing ? "Cancel Edit" : "Edit Request"}</Button> : null}
          {permissions?.can_process && detail.status === "pending" ? <Button disabled={updating} onClick={() => void patch({ status: "under_review" })}>Start Review</Button> : null}
          {permissions?.can_create_invoice && detail.status === "under_review" ? <Button nativeButton={false} render={<Link href={`/dashboard/invoices/new?requestId=${detail.id}`} />}><FileUpIcon />Upload Invoice</Button> : null}
          {detail.invoice ? <Button nativeButton={false} render={<Link href={`/dashboard/invoices/${detail.invoice.id}`} />} variant="outline">Open {detail.invoice.invoice_number}</Button> : null}
          {permissions?.can_archive && ["pending", "under_review"].includes(detail.status) ? <Button disabled={updating} onClick={() => void patch({ status: "archived" })} variant="outline">Archive</Button> : null}
          {permissions?.can_reopen && detail.status === "archived" ? <Button disabled={updating} onClick={() => void patch({ status: "pending" })}>Reopen</Button> : null}
          {permissions?.can_delete && !detail.invoice ? <Button aria-label="Delete request" disabled={updating} onClick={() => void remove()} size="icon" variant="outline"><Trash2Icon /></Button> : null}
        </div>
      </div>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Accepted PO billing context</CardTitle></CardHeader><CardContent><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Job Number", detail.job_number_snapshot ?? "-"], ["PO Number", detail.po_number_snapshot], ["PO Received", detail.po_received_date_snapshot],
              ["Customer", detail.customer_name_snapshot], ["Project", detail.project_name_snapshot ?? "-"], ["Quotation", detail.quotation_number_snapshot],
              ["Revision", String(detail.revision_number_snapshot)], ["Salesperson", detail.salesperson_snapshot ?? "-"], ["Customer Contact", detail.customer_contact_snapshot ?? "-"],
              ["PO Grand Total", money(detail.po_total_snapshot, detail.currency)], ["Payment Terms", title(detail.payment_terms_snapshot ?? "-")], ["Tax Information", detail.customer_tax_snapshot ?? "-"],
              ["Customer Address", detail.customer_address_snapshot ?? "-"], ["Billing Address", detail.billing_address_snapshot ?? "-"], ["Shipping Address", detail.shipping_address_snapshot ?? "-"],
            ].map(([label, value]) => <div key={label}><dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}
          </dl></CardContent></Card>
          <Card><CardHeader><CardTitle>Billing instructions</CardTitle></CardHeader><CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">{[["Invoice Type", title(detail.invoice_type)], ["Amount Method", title(detail.amount_type)], ["Amount to Invoice", money(detail.requested_amount, detail.currency)]].map(([label, value]) => <div key={label}><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}</div>
            {editing ? <>
              <div className="space-y-2"><Label htmlFor="edit-description">Billing Description</Label><Textarea id="edit-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
              <div className="space-y-2"><Label>Items to Include</Label><div className="grid gap-2 sm:grid-cols-2">{Object.entries(itemLabels).map(([value, label]) => <label className="flex items-center gap-2 text-sm" key={value}><Checkbox checked={items.includes(value)} onChange={(event) => setItems((current) => event.target.checked ? [...current, value] : current.filter((item) => item !== value))} />{label}</label>)}</div></div>
              <div className="space-y-2"><Label htmlFor="edit-comments">Comments for Accounts</Label><Textarea id="edit-comments" value={comments} onChange={(event) => setComments(event.target.value)} /></div>
              <Button disabled={updating || !description.trim()} onClick={() => void patch({ billing_description: description, comments_for_accounts: comments, items_to_include: items })}>{updating ? "Saving..." : "Save Changes"}</Button>
            </> : <>
              <div><p className="text-xs uppercase tracking-wide text-zinc-500">Billing Description</p><p className="mt-2 whitespace-pre-wrap text-sm">{detail.billing_description}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-zinc-500">Items to Include</p><div className="mt-2 flex flex-wrap gap-2">{detail.items_to_include.length ? detail.items_to_include.map((item) => <Badge key={item} variant="outline">{itemLabels[item] ?? title(item)}</Badge>) : <span className="text-sm text-zinc-500">None selected</span>}</div></div>
              <div><p className="text-xs uppercase tracking-wide text-zinc-500">Comments for Accounts</p><p className="mt-2 whitespace-pre-wrap text-sm">{detail.comments_for_accounts ?? "-"}</p></div>
            </>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Supporting Documents</CardTitle></CardHeader><CardContent className="space-y-3">
            {detail.documents.map((document) => <div className="flex items-center justify-between rounded-md border p-3" key={document.id}><span className="truncate text-sm font-medium">{document.file_name}</span>{document.signed_url ? <Button nativeButton={false} render={<a href={document.signed_url} rel="noreferrer" target="_blank" />} size="sm" variant="ghost"><DownloadIcon />Open</Button> : null}</div>)}
            {!detail.documents.length ? <p className="text-sm text-zinc-500">No supporting documents attached.</p> : null}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Purchase Order Documents</CardTitle></CardHeader><CardContent className="space-y-3">
            {detail.purchase_order_documents.map((document) => <div className="flex items-center justify-between rounded-md border p-3" key={document.id}><div><p className="truncate text-sm font-medium">{document.file_name}</p><p className="mt-1 text-xs text-zinc-500">{title(document.document_type)}</p></div>{document.signed_url ? <Button nativeButton={false} render={<a href={document.signed_url} rel="noreferrer" target="_blank" />} size="sm" variant="ghost"><DownloadIcon />Open</Button> : null}</div>)}
            {!detail.purchase_order_documents.length ? <p className="text-sm text-zinc-500">No purchase order documents available.</p> : null}
          </CardContent></Card>
        </div>
        <div className="space-y-6">
          <Card><CardHeader><CardTitle>Accounts invoice entry</CardTitle></CardHeader><CardContent>
            {detail.invoice ? <p className="text-sm">Invoice <Link className="font-semibold hover:underline" href={`/dashboard/invoices/${detail.invoice.id}`}>{detail.invoice.invoice_number}</Link> is linked to this request.</p> : detail.status === "under_review" && permissions?.can_create_invoice ? <><p className="text-sm text-zinc-500">Create the invoice in the company invoice system, then upload its PDF copy and record the invoice details in CRM.</p><Button className="mt-4" nativeButton={false} render={<Link href={`/dashboard/invoices/new?requestId=${detail.id}`} />}><FileUpIcon />Upload Invoice Copy</Button></> : <p className="text-sm text-zinc-500">Accounts can upload an invoice after starting review.</p>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>Workflow History</CardTitle></CardHeader><CardContent className="space-y-4">
            {detail.status_history.map((event, index) => <div className="flex gap-3" key={event.id}><div className="flex flex-col items-center"><span className="mt-1 size-2 rounded-full bg-zinc-950" />{index < detail.status_history.length - 1 ? <span className="h-full w-px bg-zinc-200" /> : null}</div><div className="pb-4"><p className="text-sm font-medium">{title(event.previous_status ?? "created")} → {title(event.new_status)}</p><p className="mt-1 flex items-center gap-1 text-xs text-zinc-500"><CalendarClockIcon className="size-3" />{new Date(event.changed_at).toLocaleString("en-CA")} · {event.actor?.full_name ?? event.actor?.email ?? "System"}</p></div></div>)}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
}
