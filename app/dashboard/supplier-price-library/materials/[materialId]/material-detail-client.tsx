"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowLeftIcon,
  CopyIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SupplierPricePermissions } from "@/lib/supplier-price-library/access";
import type {
  Pagination,
  SupplierPriceMaterial,
  SupplierPriceRecord,
  SupplierPriceSupplier,
} from "@/lib/supplier-price-library/types";
import {
  PriceFormFields,
  type SupplierPriceDraft,
} from "../../price-form-fields";
import { ModuleHeader } from "../../module-tabs";

type LatestPrice = SupplierPriceRecord & { supplier_name?: string };
type PriceData = {
  latest: LatestPrice[];
  history: SupplierPriceRecord[];
  pagination: Pagination;
  unit_of_measure: string;
};

export function MaterialDetailClient({
  materialId,
  permissions,
}: {
  materialId: string;
  permissions: SupplierPricePermissions;
}) {
  const [material, setMaterial] = useState<SupplierPriceMaterial | null>(null);
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierPriceSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [correcting, setCorrecting] = useState<SupplierPriceRecord | null>(null);
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historySupplier, setHistorySupplier] = useState("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "1") {
      queueMicrotask(() => setToast("Material created successfully."));
    } else if (params.get("priceAdded") === "1") {
      queueMicrotask(() => setToast("Supplier price added successfully."));
    }
    if (params.has("created") || params.has("priceAdded")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        page: String(page),
        pageSize: "25",
        status: historyStatus,
      });
      if (historySupplier !== "all") query.set("supplier", historySupplier);
      const [materialResponse, pricesResponse, suppliersResponse] = await Promise.all([
        fetch(`/api/org/supplier-price-library/materials/${materialId}`, {
          cache: "no-store",
        }),
        fetch(
          `/api/org/supplier-price-library/materials/${materialId}/prices?${query}`,
          { cache: "no-store" },
        ),
        fetch(
          "/api/org/supplier-price-library/suppliers?status=all&pageSize=100",
          { cache: "no-store" },
        ),
      ]);
      const [materialPayload, pricePayload, supplierPayload] = await Promise.all([
        materialResponse.json(),
        pricesResponse.json(),
        suppliersResponse.json(),
      ]);
      if (!materialResponse.ok) throw new Error(materialPayload.error);
      if (!pricesResponse.ok) throw new Error(pricePayload.error);
      setMaterial(materialPayload.material);
      setPrices(pricePayload);
      setSuppliers(supplierPayload.suppliers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load material");
    } finally {
      setLoading(false);
    }
  }, [historyStatus, historySupplier, materialId, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load, refresh]);

  const materialLabel = material
    ? [
        material.material_code,
        material.material_description,
        material.size_specification,
        material.grade_material_type,
      ]
        .filter(Boolean)
        .join(" — ")
    : "";

  async function toggleMaterial() {
    if (!material) return;
    const action = material.is_archived ? "restore" : "archive";
    const response = await fetch(
      `/api/org/supplier-price-library/materials/${material.id}/${action}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error);
      return;
    }
    setToast(material.is_archived ? "Material restored." : "Material archived.");
    setRefresh((value) => value + 1);
  }

  async function archivePrice(price: SupplierPriceRecord) {
    if (!window.confirm("Archive this supplier price? It remains in history.")) return;
    const response = await fetch(
      `/api/org/supplier-price-library/prices/${price.id}/archive`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error);
      return;
    }
    setToast("Supplier price archived.");
    setRefresh((value) => value + 1);
  }

  if (loading && !material) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleHeader
        title={material ? `${material.material_code} · ${material.material_description}` : "Material"}
        description="Master material information and supplier price history."
        actions={material ? <div className="flex flex-wrap gap-2">
          {permissions.canEdit ? <>
            <Button nativeButton={false} variant="outline" render={<Link href={`/dashboard/supplier-price-library/materials/${material.id}/edit`} />}><PencilIcon /> Edit Material</Button>
            <Button nativeButton={false} variant="outline" render={<Link href={`/dashboard/supplier-price-library/materials/new?duplicate=${material.id}`} />}><CopyIcon /> Duplicate Material</Button>
            <Button variant="outline" onClick={() => void toggleMaterial()}>{material.is_archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}{material.is_archived ? "Restore" : "Archive"}</Button>
            {!material.is_archived ? <Button nativeButton={false} render={<Link href={`/dashboard/supplier-price-library/prices/new?materialId=${material.id}`} />}><PlusIcon /> Add Supplier Price</Button> : null}
          </> : null}
        </div> : undefined}
      />
      <Button nativeButton={false} variant="ghost" render={<Link href="/dashboard/supplier-price-library/materials" />}><ArrowLeftIcon /> Back to Materials</Button>
      {toast ? <div className="fixed right-4 top-4 z-[100] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast}</div> : null}
      {error ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</div> : null}

      {material ? <MaterialInformation material={material} /> : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Supplier Price Summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Latest active price from each supplier.</p>
          </div>
          {permissions.canEdit && material && !material.is_archived ? <Button nativeButton={false} render={<Link href={`/dashboard/supplier-price-library/prices/new?materialId=${material.id}`} />}><PlusIcon /> Add Supplier Price</Button> : null}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Quote Number</TableHead><TableHead>Quote Date</TableHead><TableHead>Unit Price</TableHead><TableHead>Currency</TableHead><TableHead>Material Unit</TableHead><TableHead>Valid Until</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {prices?.latest.length ? prices.latest.map((price) => <TableRow key={price.id}><TableCell className="font-medium">{price.supplier?.company_name ?? price.supplier_name ?? "—"}</TableCell><TableCell>{price.supplier_quote_number ?? "—"}</TableCell><TableCell>{formatDate(price.quote_date)}</TableCell><TableCell>{Number(price.unit_price).toFixed(2)}</TableCell><TableCell>{price.currency}</TableCell><TableCell>{material?.unit_of_measure ?? "—"}</TableCell><TableCell>{formatDate(price.price_valid_until)}</TableCell><TableCell><Badge variant="secondary">Latest</Badge></TableCell></TableRow>) : <EmptyPriceRow colSpan={8} permissions={permissions} materialId={materialId} text="No supplier prices have been recorded for this material." />}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Complete Price History</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <SimpleSelect value={historySupplier} onChange={(value) => { setHistorySupplier(value); setPage(1); }} all="All suppliers" options={suppliers.map((supplier) => [supplier.id, supplier.company_name])} />
            <SimpleSelect value={historyStatus} onChange={(value) => { setHistoryStatus(value); setPage(1); }} all="All statuses" options={[["active", "Active"], ["superseded", "Superseded"], ["archived", "Archived"]]} />
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Quote Number</TableHead><TableHead>Quote Date</TableHead><TableHead>Unit Price</TableHead><TableHead>Currency</TableHead><TableHead>Valid Until</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead>Added By</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {prices?.history.length ? prices.history.map((price) => <TableRow className={price.record_status === "superseded" ? "opacity-60" : ""} key={price.id}><TableCell>{price.supplier?.company_name ?? "—"}</TableCell><TableCell>{price.supplier_quote_number ?? "—"}</TableCell><TableCell>{formatDate(price.quote_date)}</TableCell><TableCell>{Number(price.unit_price).toFixed(2)}</TableCell><TableCell>{price.currency}</TableCell><TableCell>{formatDate(price.price_valid_until)}</TableCell><TableCell><Badge variant={price.record_status === "active" ? "secondary" : "outline"}>{price.record_status}</Badge></TableCell><TableCell className="max-w-56 truncate">{price.notes ?? "—"}</TableCell><TableCell>{price.added_by?.full_name ?? price.added_by?.email ?? "—"}</TableCell><TableCell className="whitespace-nowrap">{permissions.canEdit && price.record_status === "active" ? <><Button size="sm" variant="outline" onClick={() => setCorrecting(price)}>Correct Price</Button><Button size="sm" variant="ghost" onClick={() => void archivePrice(price)}>Archive</Button></> : "—"}</TableCell></TableRow>) : <EmptyPriceRow colSpan={10} permissions={permissions} materialId={materialId} text="No supplier prices match the current filters." />}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{prices?.pagination.total ?? 0} records · Page {prices?.pagination.page ?? 1} of {prices?.pagination.totalPages ?? 1}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button variant="outline" disabled={!prices || page >= prices.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div></div>
        </CardContent>
      </Card>

      <PriceTimeline history={prices?.history ?? []} suppliers={suppliers} />

      {correcting && material ? <CorrectionDialog key={correcting.id} original={correcting} materialLabel={materialLabel} suppliers={suppliers.filter((supplier) => !supplier.is_archived)} onSupplierCreated={(supplier) => setSuppliers((current) => [...current, supplier])} onClose={() => setCorrecting(null)} onSaved={() => { setCorrecting(null); setToast("Corrected price added; the original remains in history."); setRefresh((value) => value + 1); }} /> : null}
    </div>
  );
}

function MaterialInformation({ material }: { material: SupplierPriceMaterial }) {
  const fields = [["Material Code", material.material_code], ["Category", material.category?.category_name ?? "—"], ["Material Description", material.material_description], ["Size / Specification", material.size_specification ?? "—"], ["Grade / Material Type", material.grade_material_type ?? "—"], ["Unit of Measure", material.unit_of_measure], ["Notes", material.notes ?? "—"]];
  return <Card><CardHeader><CardTitle>Material Information</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label, value]) => <div key={label}><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-1 whitespace-pre-wrap">{value}</p></div>)}</CardContent></Card>;
}

function CorrectionDialog({ original, materialLabel, suppliers, onSupplierCreated, onClose, onSaved }: { original: SupplierPriceRecord; materialLabel: string; suppliers: SupplierPriceSupplier[]; onSupplierCreated: (supplier: SupplierPriceSupplier) => void; onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<SupplierPriceDraft>({ supplier_id: original.supplier_id, supplier_quote_number: original.supplier_quote_number ?? "", unit_price: String(original.unit_price), currency: original.currency, quote_date: original.quote_date, price_valid_until: original.price_valid_until ?? "", notes: original.notes ?? "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) { event.preventDefault(); setSaving(true); setError(""); try { const response = await fetch(`/api/org/supplier-price-library/prices/${original.id}/correct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, unit_price: Number(draft.unit_price) }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error); onSaved(); } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to correct price"); } finally { setSaving(false); } }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-2xl"><form className="space-y-5" onSubmit={submit}><DialogHeader><DialogTitle>Correct Price</DialogTitle><DialogDescription>The original supplier price remains in history and the corrected price is added as a new record.</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/40 p-3 text-sm">Original: {original.supplier?.company_name ?? "Supplier"} · {original.currency} {Number(original.unit_price).toFixed(2)} · {formatDate(original.quote_date)}</div><PriceFormFields draft={draft} onChange={setDraft} suppliers={suppliers} onSupplierCreated={onSupplierCreated} materialLabel={materialLabel} />{error ? <p className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !draft.supplier_id}>{saving ? "Saving…" : "Add Corrected Price"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PriceTimeline({ history, suppliers }: { history: SupplierPriceRecord[]; suppliers: SupplierPriceSupplier[] }) {
  const supplierIds = Array.from(new Set(history.map((price) => price.supplier_id)));
  const [supplierId, setSupplierId] = useState(supplierIds[0] ?? "none");
  const effectiveSupplier = supplierIds.includes(supplierId) ? supplierId : supplierIds[0] ?? "none";
  const currencies = Array.from(new Set(history.filter((price) => price.supplier_id === effectiveSupplier).map((price) => price.currency)));
  const [currency, setCurrency] = useState(currencies[0] ?? "none");
  const effectiveCurrency = currencies.includes(currency) ? currency : currencies[0] ?? "none";
  const points = useMemo(() => history.filter((price) => price.supplier_id === effectiveSupplier && price.currency === effectiveCurrency).toSorted((a, b) => a.quote_date.localeCompare(b.quote_date)), [effectiveCurrency, effectiveSupplier, history]);
  return <Card><CardHeader><CardTitle>Price Timeline</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><SimpleSelect value={effectiveSupplier} onChange={setSupplierId} all="No supplier" allValue="none" options={suppliers.filter((supplier) => supplierIds.includes(supplier.id)).map((supplier) => [supplier.id, supplier.company_name])} /><SimpleSelect value={effectiveCurrency} onChange={setCurrency} all="No currency" allValue="none" options={currencies.map((value) => [value, value])} /></div><MiniChart points={points} /></CardContent></Card>;
}

function MiniChart({ points }: { points: SupplierPriceRecord[] }) {
  if (!points.length) return <div className="flex h-44 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">No timeline data for this selection.</div>;
  const values = points.map((point) => Number(point.unit_price)); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
  const coordinates = points.map((point, index) => ({ x: 30 + (index / Math.max(1, points.length - 1)) * 700, y: 190 - ((Number(point.unit_price) - minimum) / range) * 150, point }));
  return <div className="overflow-x-auto"><svg className="min-w-[760px] text-foreground" viewBox="0 0 760 220" role="img" aria-label="Historical supplier price line chart"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} />{coordinates.map(({ x, y, point }) => <circle key={point.id} cx={x} cy={y} r="4" fill="currentColor"><title>{point.quote_date}: {point.currency} {Number(point.unit_price).toFixed(2)}</title></circle>)}</svg></div>;
}

function EmptyPriceRow({ colSpan, text, permissions, materialId }: { colSpan: number; text: string; permissions: SupplierPricePermissions; materialId: string }) {
  return <TableRow><TableCell className="py-12 text-center" colSpan={colSpan}><p className="text-muted-foreground">{text}</p>{permissions.canEdit ? <Button className="mt-4" nativeButton={false} render={<Link href={`/dashboard/supplier-price-library/prices/new?materialId=${materialId}`} />}><PlusIcon /> Add First Supplier Price</Button> : null}</TableCell></TableRow>;
}

function SimpleSelect({ value, onChange, all, options, allValue = "all" }: { value: string; onChange: (value: string) => void; all: string; options: string[][]; allValue?: string }) {
  return <Select value={value} onValueChange={(next) => onChange(String(next))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={allValue}>{all}</SelectItem>{options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}</SelectContent></Select>;
}

function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(`${value}${value.length === 10 ? "T12:00:00" : ""}`)) : "—"; }
