"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangleIcon, ArrowLeftIcon, ExternalLinkIcon, PlusIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Document = { id: string; file_name: string; document_type: string };
type RevisionItem = {
  allocation_id: string;
  quotation_number_snapshot: string;
  quotation_revision_snapshot: number;
  project_name_snapshot?: string | null;
  quotation_amount_snapshot: number | string;
  po_amount_snapshot: number | string;
  job_number_snapshot?: string | null;
  job_status_snapshot: string;
  current_job_status?: string | null;
  current_job_number?: string | null;
  current_completion?: {
    completion_status: string;
    completion_date: string;
  } | null;
  change_type: "original" | "carried" | "added" | "removed";
  is_included: boolean;
};
type Revision = {
  id: string;
  revision_number: number;
  revision_date: string;
  revised_po_amount: number | string;
  difference_amount: number | string;
  change_percentage?: number | string | null;
  items: RevisionItem[];
};
type PurchaseOrder = {
  id: string;
  customer_id: string;
  po_number: string;
  po_received_date: string;
  currency: string;
  combined_po_total: number | string;
  current_po_total: number | string;
  current_revision_number: number | string;
  customer?: { company_name?: string | null } | null;
  customer_contact?: {
    first_name: string;
    last_name?: string | null;
    email?: string | null;
  } | null;
  documents: Document[];
  revisions: Revision[];
};
type Selection = {
  selected: boolean;
  amount: string;
  acknowledged: boolean;
  scopeIds: string[];
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(
    numeric(value),
  );
}

function signed(value: number, currency: string) {
  if (Math.abs(value) < 0.005) return money(0, currency);
  return `${value > 0 ? "+" : "-"}${money(Math.abs(value), currency)}`;
}

function title(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

export default function NewPurchaseOrderRevisionPage() {
  const { poId } = useParams<{ poId: string }>();
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [revisionDate, setRevisionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [document, setDocument] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [canOverrideCustomer, setCanOverrideCustomer] = useState(false);
  const [allowCustomerOverride, setAllowCustomerOverride] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/org/job-purchase-orders/${poId}/revisions`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { purchase_order?: PurchaseOrder; available_jobs?: JobListItem[]; permissions?: { can_override_customer?: boolean }; error?: string }
          | null;
        if (!response.ok || !payload?.purchase_order) {
          setError(payload?.error ?? "Unable to load the purchase order.");
          return;
        }
        setPo(payload.purchase_order);
        setJobs(payload.available_jobs ?? []);
        setCanOverrideCustomer(payload.permissions?.can_override_customer ?? false);
        const requested = new Set(
          new URLSearchParams(window.location.search).get("jobs")?.split(",").filter(Boolean) ?? [],
        );
        const initial: Record<string, Selection> = {};
        for (const job of payload.available_jobs ?? []) {
          if (!requested.has(job.id)) continue;
          initial[job.id] = {
            selected: true,
            amount: String(numeric(job.quotation?.grand_total_before_tax)),
            acknowledged: false,
            scopeIds: job.assigned_scopes.map((scope) => scope.id),
          };
        }
        setSelections(initial);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") setError("Unable to load the purchase order.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [poId]);

  async function changeCustomerOverride(enabled: boolean) {
    setAllowCustomerOverride(enabled);
    setSelections({});
    setSearch("");
    const response = await fetch(
      `/api/org/job-purchase-orders/${poId}/revisions${enabled ? "?override_customer=1" : ""}`,
      { cache: "no-store" },
    );
    const payload = (await response.json().catch(() => null)) as
      | { available_jobs?: JobListItem[]; error?: string }
      | null;
    if (!response.ok) {
      setError(payload?.error ?? "Unable to load available quotations.");
      return;
    }
    setJobs(payload?.available_jobs ?? []);
  }

  const currentRevision = po?.revisions.find(
    (revision) => numeric(revision.revision_number) === numeric(po.current_revision_number),
  );
  const originalRevision = po?.revisions.find((revision) => numeric(revision.revision_number) === 0);
  const currentItems = currentRevision?.items.filter((item) => item.is_included) ?? [];
  const selectedJobs = jobs.filter((job) => selections[job.id]?.selected);
  const calculations = selectedJobs.map((job) => {
    const beforeTax = numeric(selections[job.id]?.amount);
    const taxRate = numeric(job.quotation?.tax_rate);
    const total = beforeTax + beforeTax * taxRate / 100;
    const quotationTotal = numeric(job.quotation?.grand_total_after_tax ?? job.quotation?.grand_total_before_tax);
    return { job, beforeTax, total, quotationTotal, difference: total - quotationTotal };
  });
  const removedTotal = currentItems
    .filter((item) => removedIds.includes(item.allocation_id))
    .reduce((sum, item) => sum + numeric(item.po_amount_snapshot), 0);
  const addedTotal = calculations.reduce((sum, row) => sum + row.total, 0);
  const previousTotal = numeric(po?.current_po_total);
  const revisedTotal = previousTotal - removedTotal + addedTotal;
  const impact = revisedTotal - previousTotal;
  const percentage = previousTotal ? impact * 100 / previousTotal : null;
  const unacknowledged = calculations.some(
    (row) => Math.abs(row.difference) >= 0.005 && !selections[row.job.id]?.acknowledged,
  );
  const filteredJobs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return jobs;
    return jobs.filter((job) => [
      job.quotation?.quotation_number,
      job.customer?.company_name,
      job.quotation?.project_name,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(query)));
  }, [jobs, search]);

  function updateSelection(job: JobListItem, patch: Partial<Selection>) {
    setSelections((current) => ({
      ...current,
      [job.id]: {
        selected: current[job.id]?.selected ?? false,
        amount: current[job.id]?.amount ?? String(numeric(job.quotation?.grand_total_before_tax)),
        acknowledged: current[job.id]?.acknowledged ?? false,
        scopeIds: current[job.id]?.scopeIds ?? job.assigned_scopes.map((scope) => scope.id),
        ...patch,
      },
    }));
  }

  function toggleRemoval(item: RevisionItem) {
    if (!removedIds.includes(item.allocation_id)) {
      const confirmed = window.confirm(
        `Are you sure you want to remove ${item.quotation_number_snapshot} from this PO revision? Historical relationships will be preserved.`,
      );
      if (!confirmed) return;
    }
    setRemovedIds((current) => current.includes(item.allocation_id)
      ? current.filter((id) => id !== item.allocation_id)
      : [...current, item.allocation_id]);
  }

  async function openDocument(item: Document) {
    const response = await fetch(`/api/org/job-purchase-orders/${poId}/documents/${item.id}`, { cache: "no-store" });
    const payload = (await response.json().catch(() => null)) as { signed_url?: string; error?: string } | null;
    if (!response.ok || !payload?.signed_url) {
      setError(payload?.error ?? "Unable to open the PO document.");
      return;
    }
    window.open(payload.signed_url, "_blank", "noopener,noreferrer");
  }

  async function submit() {
    if (!po || !document || submitting) return;
    setSubmitting(true);
    setError(null);
    const form = new FormData();
    form.set("revision_date", revisionDate);
    form.set("internal_remarks", remarks);
    form.set("revised_po_document", document);
    form.set("removed_allocation_ids", JSON.stringify(removedIds));
    form.set("allow_customer_override", String(allowCustomerOverride));
    form.set("added_allocations", JSON.stringify(calculations.map(({ job, beforeTax }) => ({
      job_id: job.id,
      po_amount_before_tax: beforeTax,
      difference_acknowledged: selections[job.id].acknowledged,
      scope_ids: selections[job.id].scopeIds,
    }))));
    try {
      const response = await fetch(`/api/org/job-purchase-orders/${poId}/revisions`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json().catch(() => null)) as { revision?: { id: string }; error?: string } | null;
      if (!response.ok || !payload?.revision) {
        setError(payload?.error ?? "Unable to create the PO revision.");
        setConfirming(false);
        return;
      }
      router.push(`/dashboard/jobs/purchase-orders/${poId}`);
      router.refresh();
    } catch {
      setError("Unable to create the PO revision.");
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-7xl">Loading revised PO...</div>;
  if (!po) return <Alert variant="destructive"><AlertDescription>{error ?? "Purchase order not found."}</AlertDescription></Alert>;
  const originalDocument = po.documents.find((item) => item.document_type === "purchase_order");
  const canConfirm = Boolean(
    document && revisionDate && (selectedJobs.length || removedIds.length) && !unacknowledged &&
    selectedJobs.every((job) => selections[job.id]?.scopeIds.length),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Button nativeButton={false} render={<Link href={`/dashboard/jobs/purchase-orders/${poId}`} />} variant="ghost">
        <ArrowLeftIcon /> Back to Purchase Order
      </Button>
      <div>
        <p className="text-sm text-zinc-500">Revised Purchase Order</p>
        <h1 className="text-2xl font-semibold">{po.po_number} · Revision {numeric(po.current_revision_number) + 1}</h1>
        <p className="mt-1 text-sm text-zinc-500">The original PO and completed jobs will remain unchanged.</p>
      </div>
      {error ? <Alert variant="destructive"><AlertTriangleIcon /><AlertTitle>Unable to continue</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}

      <Card>
        <CardHeader><CardTitle>Existing PO Information</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Customer Name", po.customer?.company_name ?? "-"],
            ["Customer Contact", po.customer_contact ? `${po.customer_contact.first_name} ${po.customer_contact.last_name ?? ""}`.trim() : "-"],
            ["Original PO Number", po.po_number],
            ["Original PO Date", po.po_received_date],
            ["Original PO Amount", money(originalRevision?.revised_po_amount ?? po.combined_po_total, po.currency)],
            ["Currency", po.currency],
            ["PO Type", (originalRevision?.items.length ?? 0) > 1 ? "Combined PO" : "Single Quotation PO"],
            ["Current Revision", numeric(po.current_revision_number) ? `Revision ${po.current_revision_number}` : "Original"],
          ].map(([label, value]) => <div key={label}><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Original PO Attachment</p>
            {originalDocument ? <Button className="mt-1" size="sm" variant="outline" onClick={() => void openDocument(originalDocument)}><ExternalLinkIcon />{originalDocument.file_name}</Button> : <p className="mt-1 text-sm">-</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Quotations and Jobs</CardTitle></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Quotation</TableHead><TableHead>Project</TableHead><TableHead>PO Amount</TableHead><TableHead>Job</TableHead><TableHead>Status</TableHead><TableHead>Remove</TableHead></TableRow></TableHeader><TableBody>
          {currentItems.map((item) => <TableRow className={removedIds.includes(item.allocation_id) ? "opacity-50" : undefined} key={item.allocation_id}>
            <TableCell>{item.quotation_number_snapshot}</TableCell><TableCell>{item.project_name_snapshot ?? "-"}</TableCell><TableCell>{money(item.po_amount_snapshot, po.currency)}</TableCell><TableCell>{item.current_job_number ?? item.job_number_snapshot ?? "-"}</TableCell><TableCell><Badge variant="outline">{title(item.current_job_status ?? item.job_status_snapshot)}</Badge>{item.current_completion ? <span className="mt-1 block text-xs text-zinc-500">{title(item.current_completion.completion_status)} · {item.current_completion.completion_date}</span> : null}</TableCell><TableCell><Checkbox checked={removedIds.includes(item.allocation_id)} onChange={() => toggleRemoval(item)} /></TableCell>
          </TableRow>)}
        </TableBody></Table></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Add Quotation to Revised PO</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search quotation number, customer, or project name" value={search} onChange={(event) => setSearch(event.target.value)} />
          {canOverrideCustomer ? (
            <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Checkbox checked={allowCustomerOverride} onChange={(event) => void changeCustomerOverride(event.target.checked)} />
              <span><span className="block font-medium">Administrator customer override</span><span className="block text-xs">Show PO-pending quotations from other customers. Cross-customer additions are exceptional and will remain visible in the revision audit trail.</span></span>
            </label>
          ) : null}
          <Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Quotation</TableHead><TableHead>Customer</TableHead><TableHead>Project</TableHead><TableHead>Scopes</TableHead><TableHead>Quotation Amount</TableHead><TableHead>Sales Representative</TableHead><TableHead>Quotation Date</TableHead><TableHead>PO Before Tax</TableHead><TableHead>Acknowledge</TableHead></TableRow></TableHeader><TableBody>
            {filteredJobs.map((job) => {
              const selected = selections[job.id]?.selected ?? false;
              const calculation = calculations.find((row) => row.job.id === job.id);
              const differs = selected && Math.abs(calculation?.difference ?? 0) >= 0.005;
              return <TableRow key={job.id}><TableCell><Checkbox checked={selected} onChange={(event) => updateSelection(job, { selected: event.target.checked, acknowledged: false })} /></TableCell><TableCell>{job.quotation?.quotation_number ?? "-"}</TableCell><TableCell>{job.customer?.company_name ?? "-"}</TableCell><TableCell>{job.quotation?.project_name ?? "-"}</TableCell><TableCell>{job.assigned_scopes.map((scope) => scope.scope_title).join(", ") || "-"}</TableCell><TableCell>{money(job.quotation?.grand_total_after_tax ?? job.quotation?.grand_total_before_tax, job.quotation?.currency ?? job.customer?.currency ?? po.currency)}</TableCell><TableCell>{job.salesperson?.full_name ?? job.salesperson?.email ?? "-"}</TableCell><TableCell>{job.quotation?.quote_date ?? "-"}</TableCell><TableCell><Input className="min-w-32" disabled={!selected} min="0" step="0.01" type="number" value={selections[job.id]?.amount ?? ""} onChange={(event) => updateSelection(job, { amount: event.target.value, acknowledged: false })} /></TableCell><TableCell>{differs ? <Checkbox checked={selections[job.id]?.acknowledged ?? false} onChange={(event) => updateSelection(job, { acknowledged: event.target.checked })} /> : "-"}</TableCell></TableRow>;
            })}
          </TableBody></Table>
          {!filteredJobs.length ? <p className="text-sm text-zinc-500">No PO-pending quotations for this customer match the search.</p> : null}
        </CardContent>
      </Card>

      {selectedJobs.map((job) => <Card key={job.id}><CardHeader><CardTitle>Work Order Scopes · {job.quotation?.quotation_number}</CardTitle></CardHeader><CardContent className="grid gap-2 sm:grid-cols-2">
        {job.assigned_scopes.map((scope) => <label className="flex gap-2 rounded-lg border p-3 text-sm" key={scope.id}><Checkbox checked={selections[job.id]?.scopeIds.includes(scope.id) ?? false} onChange={(event) => updateSelection(job, { scopeIds: event.target.checked ? [...(selections[job.id]?.scopeIds ?? []), scope.id] : (selections[job.id]?.scopeIds ?? []).filter((id) => id !== scope.id) })} /><span><span className="block font-medium">{scope.scope_title}</span>{scope.scope_description ? <span className="text-xs text-zinc-500">{scope.scope_description}</span> : null}</span></label>)}
      </CardContent></Card>)}

      <Card><CardHeader><CardTitle>PO Revision Impact</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {[["Original PO Amount", money(previousTotal, po.currency)], ["Added Quotations", signed(addedTotal, po.currency)], ["Removed Quotations", removedTotal ? `-${money(removedTotal, po.currency)}` : money(0, po.currency)], ["Revised PO Amount", money(revisedTotal, po.currency)], ["Change", `${signed(impact, po.currency)}${percentage === null ? "" : ` (${percentage >= 0 ? "+" : ""}${percentage.toFixed(2)}%)`}`]].map(([label, value]) => <div key={label}><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>)}
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Revised PO Document</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="revision-date">Revision Date</Label><Input id="revision-date" required type="date" value={revisionDate} onChange={(event) => setRevisionDate(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="revision-document">Upload Revised PO</Label><Input accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" id="revision-document" required type="file" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} /><p className="text-xs text-zinc-500">Required · PDF, JPG, or PNG · Maximum 15 MB</p></div>
        <div className="space-y-2 md:col-span-2"><Label htmlFor="revision-remarks">Internal Remarks</Label><Textarea id="revision-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></div>
      </CardContent></Card>

      <div className="flex justify-end"><Button disabled={!canConfirm} onClick={() => setConfirming(true)}><PlusIcon />Review PO Revision</Button></div>

      <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>PO Revision Summary</DialogTitle><DialogDescription>Review the exact revision before confirming. This action creates an audit snapshot.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2"><p><span className="text-zinc-500">Customer:</span> {po.customer?.company_name ?? "-"}</p><p><span className="text-zinc-500">PO Number:</span> {po.po_number}</p><p><span className="text-zinc-500">Current Revision:</span> {numeric(po.current_revision_number) ? `Revision ${po.current_revision_number}` : "Original"}</p><p><span className="text-zinc-500">New Document:</span> {document?.name ?? "-"}</p></div>
        <div><p className="font-medium">Added Quotations</p><p className="text-sm text-zinc-500">{selectedJobs.map((job) => job.quotation?.quotation_number).join(", ") || "None"}</p></div><div><p className="font-medium">Removed Quotations</p><p className="text-sm text-zinc-500">{currentItems.filter((item) => removedIds.includes(item.allocation_id)).map((item) => item.quotation_number_snapshot).join(", ") || "None"}</p></div>
        <div className="rounded-xl border p-4"><p>Current PO Total: <strong>{money(previousTotal, po.currency)}</strong></p><p>Revised PO Total: <strong>{money(revisedTotal, po.currency)}</strong></p><p>PO Revision Impact: <strong>{signed(impact, po.currency)}{percentage === null ? "" : ` · ${percentage >= 0 ? "+" : ""}${percentage.toFixed(2)}%`}</strong></p></div>
        <DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={submitting} onClick={() => void submit()}>{submitting ? "Creating Revision..." : "Confirm PO Revision"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
