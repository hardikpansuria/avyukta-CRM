"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  BoxesIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  PlusIcon,
  ReceiptTextIcon,
  TruckIcon,
  UserRoundPlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ModuleHeader } from "./module-tabs";

type DashboardData = {
  counts: { suppliers: number; categories: number; materials: number; prices: number };
  permissions: SupplierPricePermissions;
  recentPrices: Array<{
    id: string;
    unit_price: number;
    currency: string;
    quote_date: string;
    material: {
      material_code: string;
      material_description: string;
      unit_of_measure: string;
    } | null;
    supplier: { company_name: string } | null;
  }>;
  recentMaterials: Array<{
    id: string;
    material_code: string;
    material_description: string;
    updated_at: string;
    category: { category_name: string } | null;
    updatedBy: { full_name: string | null; email: string | null } | null;
  }>;
};

const stats = [
  ["suppliers", "Total Suppliers", TruckIcon],
  ["categories", "Total Material Categories", FolderTreeIcon],
  ["materials", "Total Materials", BoxesIcon],
  ["prices", "Total Supplier Price Records", ReceiptTextIcon],
] as const;

export function LibraryDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/org/supplier-price-library/dashboard", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        setData(payload);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
      });
  }, []);

  const quickActions = data?.permissions.canEdit ? (
    <div className="flex flex-wrap gap-2">
      <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/supplier-price-library/suppliers/new" />}>
        <UserRoundPlusIcon /> New Supplier
      </Button>
      <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/supplier-price-library/categories?new=1" />}>
        <FolderPlusIcon /> New Category
      </Button>
      <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/dashboard/supplier-price-library/materials/new" />}>
        <PlusIcon /> New Material
      </Button>
      <Button nativeButton={false} size="sm" render={<Link href="/dashboard/supplier-price-library/prices/new" />}>
        <PlusIcon /> Add Supplier Price
      </Button>
    </div>
  ) : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleHeader
        title="Supplier Price Library"
        description="Independent reference library for master materials and historical supplier pricing."
        actions={quickActions}
      />
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([key, label, Icon]) => (
          <Card key={key} size="sm">
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">
                  {data ? data.counts[key] : <Skeleton className="h-9 w-16" />}
                </p>
              </div>
              <Icon className="size-8 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recently Added Prices</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Supplier</TableHead><TableHead>Price</TableHead><TableHead>Quote Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {!data ? <LoadingRows cols={4} /> : data.recentPrices.length ? data.recentPrices.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell><p className="font-medium">{record.material?.material_code ?? "—"}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{record.material?.material_description ?? "—"} · {record.material?.unit_of_measure ?? "—"}</p></TableCell>
                    <TableCell>{record.supplier?.company_name ?? "—"}</TableCell>
                    <TableCell className="font-medium tabular-nums">{record.currency} {Number(record.unit_price).toFixed(2)}</TableCell>
                    <TableCell>{date(record.quote_date)}</TableCell>
                  </TableRow>
                )) : <Empty cols={4} />}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recently Updated Materials</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Material</TableHead><TableHead>Category</TableHead><TableHead>Updated</TableHead><TableHead>Updated By</TableHead></TableRow></TableHeader>
              <TableBody>
                {!data ? <LoadingRows cols={4} /> : data.recentMaterials.length ? data.recentMaterials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell><p className="font-medium">{material.material_code}</p><p className="max-w-64 truncate text-xs text-muted-foreground">{material.material_description}</p></TableCell>
                    <TableCell>{material.category?.category_name ?? "—"}</TableCell>
                    <TableCell>{date(material.updated_at)}</TableCell>
                    <TableCell>{material.updatedBy?.full_name ?? material.updatedBy?.email ?? "—"}</TableCell>
                  </TableRow>
                )) : <Empty cols={4} />}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LoadingRows({ cols }: { cols: number }) {
  return <>{Array.from({ length: 4 }).map((_, index) => <TableRow key={index}><TableCell colSpan={cols}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)}</>;
}

function Empty({ cols }: { cols: number }) {
  return <TableRow><TableCell colSpan={cols} className="py-10 text-center text-muted-foreground">No records yet.</TableCell></TableRow>;
}

function date(value: string) {
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(new Date(value));
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{message}</div>;
}
