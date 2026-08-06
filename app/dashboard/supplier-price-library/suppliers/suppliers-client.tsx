"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
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
  SupplierPriceSupplier,
} from "@/lib/supplier-price-library/types";
import {
  emptySupplierForm,
  saveSupplier,
  SupplierFields,
  type SupplierFormValue,
} from "../supplier-form";
import { ModuleHeader } from "../module-tabs";

export function SuppliersClient({
  permissions,
}: {
  permissions: SupplierPricePermissions;
}) {
  const [suppliers, setSuppliers] = useState<SupplierPriceSupplier[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("company_name");
  const [direction, setDirection] = useState("asc");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<SupplierPriceSupplier | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") === "1") {
      queueMicrotask(() => setToast("Supplier created successfully."));
      params.delete("created");
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${params.size ? `?${params}` : ""}`,
      );
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        search,
        status,
        sort,
        direction,
        page: String(page),
        pageSize: "20",
      });
      const response = await fetch(
        `/api/org/supplier-price-library/suppliers?${params}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setSuppliers(payload.suppliers);
      setPagination(payload.pagination);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load suppliers",
      );
    } finally {
      setLoading(false);
    }
  }, [direction, page, search, sort, status]);

  useEffect(() => {
    queueMicrotask(() => void loadSuppliers());
  }, [loadSuppliers, refresh]);

  async function toggleArchived(supplier: SupplierPriceSupplier) {
    const action = supplier.is_archived ? "restore" : "archive";
    if (
      !window.confirm(
        supplier.is_archived
          ? `Restore ${supplier.company_name}?`
          : `Archive ${supplier.company_name}? Historical prices remain visible.`,
      )
    )
      return;
    const response = await fetch(
      `/api/org/supplier-price-library/suppliers/${supplier.id}/${action}`,
      { method: "POST" },
    );
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error ?? "Action failed");
      return;
    }
    setToast(supplier.is_archived ? "Supplier restored." : "Supplier archived.");
    setRefresh((value) => value + 1);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleHeader
        title="Suppliers"
        description="Manage the supplier profiles used by material price records."
        actions={
          permissions.canEdit ? (
            <Button
              nativeButton={false}
              render={
                <Link href="/dashboard/supplier-price-library/suppliers/new" />
              }
            >
              <PlusIcon /> New Supplier
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
              placeholder="Search company, contact or email"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <ListSelect
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={[
              ["active", "Active"],
              ["archived", "Archived"],
              ["all", "All statuses"],
            ]}
          />
          <ListSelect
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            options={[
              ["company_name", "Company name"],
              ["created_at", "Date added"],
              ["updated_at", "Last updated"],
            ]}
          />
          <Button
            variant="outline"
            onClick={() =>
              setDirection((value) => (value === "asc" ? "desc" : "asc"))
            }
          >
            {direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        </CardContent>
      </Card>

      {error ? <ErrorBox message={error} /> : null}
      {toast ? <Toast message={toast} /> : null}

      <Card>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Contact Number</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={8}>
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
              {!loading && suppliers.length === 0 ? (
                <TableRow>
                  <TableCell className="py-14 text-center" colSpan={8}>
                    <p className="text-muted-foreground">
                      No suppliers have been added yet.
                    </p>
                    {permissions.canEdit ? (
                      <Button
                        className="mt-4"
                        nativeButton={false}
                        render={
                          <Link href="/dashboard/supplier-price-library/suppliers/new" />
                        }
                      >
                        <PlusIcon /> Create First Supplier
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading
                ? suppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell className="font-medium">
                        {supplier.company_name}
                      </TableCell>
                      <TableCell>{supplier.contact_person ?? "—"}</TableCell>
                      <TableCell>{supplier.email_address ?? "—"}</TableCell>
                      <TableCell>{supplier.contact_number ?? "—"}</TableCell>
                      <TableCell className="max-w-56 truncate">
                        {supplier.company_address ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={supplier.is_archived ? "outline" : "secondary"}>
                          {supplier.is_archived ? "Archived" : "Active"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(supplier.created_at)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {permissions.canEdit ? (
                          <>
                            <Button
                              aria-label={`Edit ${supplier.company_name}`}
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => setEditing(supplier)}
                            >
                              <PencilIcon />
                            </Button>
                            <Button
                              aria-label={
                                supplier.is_archived
                                  ? `Restore ${supplier.company_name}`
                                  : `Archive ${supplier.company_name}`
                              }
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => void toggleArchived(supplier)}
                            >
                              {supplier.is_archived ? (
                                <ArchiveRestoreIcon />
                              ) : (
                                <ArchiveIcon />
                              )}
                            </Button>
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground">
          {pagination.total} suppliers · Page {pagination.page} of{" "}
          {pagination.totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            disabled={loading || page <= 1}
            variant="outline"
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeftIcon /> Previous
          </Button>
          <Button
            disabled={loading || page >= pagination.totalPages}
            variant="outline"
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ChevronRightIcon />
          </Button>
        </div>
      </div>

      {editing ? (
        <EditSupplierDialog
          key={editing.id}
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setToast("Supplier updated successfully.");
            setRefresh((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function EditSupplierDialog({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: SupplierPriceSupplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SupplierFormValue>({
    ...emptySupplierForm,
    company_name: supplier.company_name,
    contact_person: supplier.contact_person ?? "",
    company_address: supplier.company_address ?? "",
    email_address: supplier.email_address ?? "",
    contact_number: supplier.contact_number ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveSupplier(form, supplier.id);
      onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save supplier");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit Supplier</DialogTitle>
            <DialogDescription>Update this library supplier profile.</DialogDescription>
          </DialogHeader>
          <SupplierFields form={form} onChange={setForm} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Supplier"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ListSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(String(next))}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([option, label]) => (
          <SelectItem key={option} value={option}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="fixed right-4 top-4 z-[100] rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}
