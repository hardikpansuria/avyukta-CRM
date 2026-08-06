"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EyeIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  SupplierPriceCategory,
  SupplierPriceMaterial,
  SupplierPriceSupplier,
} from "@/lib/supplier-price-library/types";
import { ModuleHeader } from "../module-tabs";

export function MaterialsClient({ permissions }: { permissions: SupplierPricePermissions }) {
  const [materials, setMaterials] = useState<SupplierPriceMaterial[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [categories, setCategories] = useState<SupplierPriceCategory[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierPriceSupplier[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("material_code");
  const [direction, setDirection] = useState("asc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/org/supplier-price-library/categories?status=all").then((response) => response.json()),
      fetch("/api/org/supplier-price-library/suppliers?status=all&pageSize=100").then((response) => response.json()),
    ]).then(([categoryData, supplierData]) => {
      setCategories(categoryData.categories ?? []);
      setSuppliers(supplierData.suppliers ?? []);
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ search, status, sort, direction, page: String(page), pageSize: "20" });
      if (category !== "all") query.set("category", category);
      if (supplier !== "all") query.set("supplier", supplier);
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);
      const response = await fetch(`/api/org/supplier-price-library/materials?${query}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setMaterials(payload.materials); setPagination(payload.pagination);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Unable to load materials"); }
    finally { setLoading(false); }
  }, [category, dateFrom, dateTo, direction, page, search, sort, status, supplier]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load, refresh]);

  function filter(update: () => void) { update(); setPage(1); }

  async function toggleMaterial(material: SupplierPriceMaterial) {
    const action = material.is_archived ? "restore" : "archive";
    if (!window.confirm(material.is_archived ? `Restore ${material.material_code}?` : `Archive ${material.material_code}? Price history remains visible.`)) return;
    const response = await fetch(`/api/org/supplier-price-library/materials/${material.id}/${action}`, { method: "POST" });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error ?? "Action failed"); return; }
    setRefresh((value) => value + 1);
  }

  return <div className="mx-auto max-w-[1500px] space-y-6">
    <ModuleHeader title="Master Material Library" description="One master material can hold historical prices from many suppliers." actions={permissions.canEdit ? <div className="flex flex-wrap gap-2"><Button nativeButton={false} variant="outline" render={<Link href="/dashboard/supplier-price-library/prices/new" />}><PlusIcon /> Add Supplier Price</Button><Button nativeButton={false} render={<Link href="/dashboard/supplier-price-library/materials/new" />}><PlusIcon /> New Material</Button></div> : undefined} />
    <Card size="sm"><CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div className="relative md:col-span-2"><SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Code, description, category, size, grade, supplier or quote number" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></div>
      <Filter value={category} onChange={(value) => filter(() => setCategory(value))} all="All categories" options={categories.map((item) => [item.id, item.category_name])} />
      <Filter value={supplier} onChange={(value) => filter(() => setSupplier(value))} all="All suppliers" options={suppliers.map((item) => [item.id, item.company_name])} />
      <Filter value={status} onChange={(value) => filter(() => setStatus(value))} all="All statuses" options={[["active", "Active"], ["archived", "Archived"]]} />
      <Filter value={sort} onChange={(value) => filter(() => setSort(value))} all="Material code" allValue="material_code" options={[["material_description", "Description"], ["created_at", "Date added"], ["updated_at", "Recently updated"], ["lowest_latest_price", "Lowest latest price"], ["most_recent_price", "Most recent price"]]} />
      <Button variant="outline" onClick={() => setDirection((value) => value === "asc" ? "desc" : "asc")}>{direction === "asc" ? "Ascending" : "Descending"}</Button>
      <Input aria-label="Quote date from" type="date" value={dateFrom} onChange={(event) => filter(() => setDateFrom(event.target.value))} />
      <Input aria-label="Quote date to" type="date" value={dateTo} onChange={(event) => filter(() => setDateTo(event.target.value))} />
    </CardContent></Card>
    {error ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</div> : null}
    <Card className="hidden lg:block"><CardContent className="overflow-x-auto px-0"><Table>
      <TableHeader><TableRow><TableHead>Material Code</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Size / Specification</TableHead><TableHead>Grade / Type</TableHead><TableHead>Unit</TableHead><TableHead>Suppliers</TableHead><TableHead>Latest Price Date</TableHead><TableHead>Lowest Latest Price</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>
        {loading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={11}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : null}
        {!loading && materials.length === 0 ? <TableRow><TableCell className="py-14 text-center" colSpan={11}><p className="text-muted-foreground">No materials match the current filters.</p>{permissions.canEdit ? <Button className="mt-4" nativeButton={false} render={<Link href="/dashboard/supplier-price-library/materials/new" />}><PlusIcon /> Create First Material</Button> : null}</TableCell></TableRow> : null}
        {!loading ? materials.map((material) => <TableRow key={material.id}><TableCell><Link className="font-medium hover:underline" href={`/dashboard/supplier-price-library/materials/${material.id}`}>{material.material_code}</Link></TableCell><TableCell>{material.category?.category_name ?? "—"}</TableCell><TableCell className="max-w-64"><p className="line-clamp-2">{material.material_description}</p></TableCell><TableCell>{material.size_specification ?? "—"}</TableCell><TableCell>{material.grade_material_type ?? "—"}</TableCell><TableCell>{material.unit_of_measure}</TableCell><TableCell>{material.supplier_count ?? 0}</TableCell><TableCell>{formatDate(material.latest_price_date)}</TableCell><TableCell>{formatPrices(material.lowest_latest_prices)}</TableCell><TableCell><Badge variant={material.is_archived ? "outline" : "secondary"}>{material.is_archived ? "Archived" : "Active"}</Badge></TableCell><TableCell className="text-right whitespace-nowrap"><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label="View material" render={<Link href={`/dashboard/supplier-price-library/materials/${material.id}`} />}><EyeIcon /></Button>{permissions.canEdit ? <><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label="Add supplier price" disabled={material.is_archived} render={<Link href={`/dashboard/supplier-price-library/prices/new?materialId=${material.id}`} />}><PlusIcon /></Button><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label="Edit material" render={<Link href={`/dashboard/supplier-price-library/materials/${material.id}/edit`} />}><PencilIcon /></Button><Button nativeButton={false} size="icon-sm" variant="ghost" aria-label="Duplicate material" render={<Link href={`/dashboard/supplier-price-library/materials/new?duplicate=${material.id}`} />}><CopyIcon /></Button><Button size="icon-sm" variant="ghost" aria-label={material.is_archived ? "Restore material" : "Archive material"} onClick={() => void toggleMaterial(material)}>{material.is_archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}</Button></> : null}</TableCell></TableRow>) : null}
      </TableBody>
    </Table></CardContent></Card>
    <div className="grid gap-3 lg:hidden">{loading ? Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-52 rounded-xl" key={index} />) : materials.map((material) => <Card key={material.id} size="sm"><CardContent className="space-y-3"><div className="flex justify-between gap-3"><div><Link className="font-semibold" href={`/dashboard/supplier-price-library/materials/${material.id}`}>{material.material_code}</Link><p className="text-sm">{material.material_description}</p></div><Badge variant={material.is_archived ? "outline" : "secondary"}>{material.is_archived ? "Archived" : "Active"}</Badge></div><p className="text-sm text-muted-foreground">{material.category?.category_name ?? "—"} · {material.size_specification ?? "No size"} · {material.unit_of_measure}</p><div className="flex flex-wrap gap-2"><Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/dashboard/supplier-price-library/materials/${material.id}`} />}><EyeIcon /> View</Button>{permissions.canEdit && !material.is_archived ? <Button nativeButton={false} size="sm" render={<Link href={`/dashboard/supplier-price-library/prices/new?materialId=${material.id}`} />}><PlusIcon /> Add Price</Button> : null}{permissions.canEdit ? <Button nativeButton={false} size="sm" variant="outline" render={<Link href={`/dashboard/supplier-price-library/materials/new?duplicate=${material.id}`} />}><CopyIcon /> Duplicate</Button> : null}</div></CardContent></Card>)}</div>
    <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-muted-foreground">{pagination.total} materials · Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeftIcon /> Previous</Button><Button variant="outline" disabled={loading || page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ChevronRightIcon /></Button></div></div>
  </div>;
}

function Filter({ value, onChange, all, options, allValue = "all" }: { value: string; onChange: (value: string) => void; all: string; options: string[][]; allValue?: string }) { return <Select value={value} onValueChange={(next) => onChange(String(next))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={allValue}>{all}</SelectItem>{options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}</SelectContent></Select>; }
function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value)) : "—"; }
function formatPrices(values: SupplierPriceMaterial["lowest_latest_prices"]) { return values?.length ? values.map((value) => `${value.currency} ${Number(value.unit_price).toFixed(2)}`).join(" · ") : "—"; }
