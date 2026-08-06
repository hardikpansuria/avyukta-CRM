"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import type { SupplierPriceCategory } from "@/lib/supplier-price-library/types";
import { CreateCategoryDialog } from "../category-form";
import { ModuleHeader } from "../module-tabs";

export function CategoriesClient({
  permissions,
  initialCreating = false,
}: {
  permissions: SupplierPricePermissions;
  initialCreating?: boolean;
}) {
  const [categories, setCategories] = useState<SupplierPriceCategory[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("category_name");
  const [direction, setDirection] = useState("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(initialCreating);
  const [editing, setEditing] = useState<SupplierPriceCategory | null>(null);
  const [confirming, setConfirming] = useState<SupplierPriceCategory | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ search, status, sort, direction });
      const response = await fetch(
        `/api/org/supplier-price-library/categories?${params}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setCategories(payload.categories);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load categories");
    } finally {
      setLoading(false);
    }
  }, [direction, search, sort, status]);

  useEffect(() => {
    queueMicrotask(() => void loadCategories());
  }, [loadCategories, refresh]);

  async function changeStatus(category: SupplierPriceCategory) {
    const action = category.is_archived ? "restore" : "archive";
    const response = await fetch(
      `/api/org/supplier-price-library/categories/${category.id}/${action}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Action failed");
      return;
    }
    setConfirming(null);
    setToast(category.is_archived ? "Category restored." : "Category archived.");
    setRefresh((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleHeader
        title="Material Categories"
        description="Maintain the categories available to master materials."
        actions={
          permissions.canEdit ? (
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> New Category
            </Button>
          ) : undefined
        }
      />

      <Card size="sm">
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search category name"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <CategorySelect value={status} onChange={setStatus} options={[["active", "Active"], ["archived", "Archived"], ["all", "All statuses"]]} />
          <CategorySelect value={sort} onChange={setSort} options={[["category_name", "Category name"], ["created_at", "Date added"], ["updated_at", "Last updated"]]} />
          <Button variant="outline" onClick={() => setDirection((value) => value === "asc" ? "desc" : "asc")}>
            {direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        </CardContent>
      </Card>

      {error ? <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</div> : null}
      {toast ? <div className="fixed right-4 top-4 z-[100] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">{toast}</div> : null}

      <Card>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category Name</TableHead>
                <TableHead>Material Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>) : null}
              {!loading && categories.length === 0 ? (
                <TableRow>
                  <TableCell className="py-14 text-center" colSpan={5}>
                    <p className="text-muted-foreground">No material categories are available.</p>
                    {permissions.canEdit ? <Button className="mt-4" onClick={() => setCreating(true)}><PlusIcon /> Create Category</Button> : null}
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading ? categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.category_name}</TableCell>
                  <TableCell>{category.material_count ?? 0}</TableCell>
                  <TableCell><Badge variant={category.is_archived ? "outline" : "secondary"}>{category.is_archived ? "Archived" : "Active"}</Badge></TableCell>
                  <TableCell>{formatDate(category.created_at)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {permissions.canEdit ? <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${category.category_name}`} onClick={() => setEditing(category)}><PencilIcon /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={category.is_archived ? `Restore ${category.category_name}` : `Archive ${category.category_name}`} onClick={() => category.is_archived ? void changeStatus(category) : setConfirming(category)}>{category.is_archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}</Button>
                    </> : "—"}
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateCategoryDialog
        key={creating ? "open" : "closed"}
        open={creating}
        onOpenChange={setCreating}
        onCreated={() => {
          setToast("Category created successfully.");
          setRefresh((value) => value + 1);
        }}
      />
      {editing ? <EditCategoryDialog key={editing.id} category={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setToast("Category updated successfully."); setRefresh((value) => value + 1); }} /> : null}
      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Archive {confirming?.category_name}?</DialogTitle><DialogDescription>Existing materials remain linked, but this category cannot be selected for new materials.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setConfirming(null)}>Cancel</Button><Button variant="destructive" onClick={() => confirming && void changeStatus(confirming)}>Archive Category</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditCategoryDialog({ category, onClose, onSaved }: { category: SupplierPriceCategory; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category.category_name);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch(`/api/org/supplier-price-library/categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category_name: name }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error); onSaved();
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Unable to save category"); } finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent><form className="space-y-5" onSubmit={submit}><DialogHeader><DialogTitle>Edit Category</DialogTitle><DialogDescription>Rename this material category.</DialogDescription></DialogHeader><div><Label>Category Name *</Label><Input className="mt-2" required value={name} onChange={(event) => setName(event.target.value)} /></div>{error ? <p className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Category"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function CategorySelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[][] }) {
  return <Select value={value} onValueChange={(next) => onChange(String(next))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{options.map(([option, label]) => <SelectItem key={option} value={option}>{label}</SelectItem>)}</SelectContent></Select>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value)); }
