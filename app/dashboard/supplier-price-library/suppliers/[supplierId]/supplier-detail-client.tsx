"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { SupplierPriceSupplier } from "@/lib/supplier-price-library/types";

import { ModuleHeader } from "../../module-tabs";

type SupplierMaterial = {
  id: string;
  material_code: string;
  material_description: string;
  size_specification?: string | null;
  grade_material_type?: string | null;
  unit_of_measure: string;
  is_archived: boolean;
  category?: { id: string; category_name: string } | null;
  latest_supplier_price?: {
    id: string;
    supplier_quote_number?: string | null;
    unit_price: number | string;
    currency: string;
    quote_date: string;
    price_valid_until?: string | null;
    record_status: string;
  } | null;
};

export function SupplierDetailClient({ supplierId }: { supplierId: string }) {
  const [supplier, setSupplier] = useState<SupplierPriceSupplier | null>(null);
  const [materials, setMaterials] = useState<SupplierMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSupplier() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/org/supplier-price-library/suppliers/${supplierId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              supplier?: SupplierPriceSupplier;
              materials?: SupplierMaterial[];
              error?: string;
            }
          | null;
        if (!response.ok || !payload?.supplier) {
          throw new Error(payload?.error ?? "Unable to load supplier.");
        }
        setSupplier(payload.supplier);
        setMaterials(payload.materials ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load supplier.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadSupplier();
    return () => controller.abort();
  }, [supplierId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-52" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <ModuleHeader
        description="Supplier contact information and every material priced by this supplier."
        title={supplier?.company_name ?? "Supplier Details"}
      />
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/supplier-price-library/suppliers" />}
        variant="ghost"
      >
        <ArrowLeftIcon /> Back to Suppliers
      </Button>

      {error ? (
        <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {supplier ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Supplier Information</CardTitle>
            <Badge variant={supplier.is_archived ? "outline" : "secondary"}>
              {supplier.is_archived ? "Archived" : "Active"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Company Name" value={supplier.company_name} />
            <Detail label="Contact Person" value={supplier.contact_person} />
            <Detail label="Email Address" value={supplier.email_address} />
            <Detail label="Contact Number" value={supplier.contact_number} />
            <Detail label="Company Address" value={supplier.company_address} />
            <Detail label="Date Added" value={formatDate(supplier.created_at)} />
            <Detail label="Last Updated" value={formatDate(supplier.updated_at)} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Materials ({materials.length})</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Materials with one or more price records from this supplier.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Specification</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Latest Price</TableHead>
                <TableHead>Quote Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.length ? (
                materials.map((material) => (
                  <TableRow key={material.id}>
                    <TableCell>
                      <Link
                        className="font-medium text-primary underline-offset-4 hover:underline"
                        href={`/dashboard/supplier-price-library/materials/${material.id}`}
                      >
                        {material.material_code}
                      </Link>
                      <p className="mt-1 max-w-80 text-xs text-muted-foreground">
                        {material.material_description}
                      </p>
                    </TableCell>
                    <TableCell>{material.category?.category_name ?? "—"}</TableCell>
                    <TableCell>
                      {[material.size_specification, material.grade_material_type]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </TableCell>
                    <TableCell>{material.unit_of_measure}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {material.latest_supplier_price
                        ? `${material.latest_supplier_price.currency} ${Number(material.latest_supplier_price.unit_price).toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {formatDate(material.latest_supplier_price?.quote_date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={material.is_archived ? "outline" : "secondary"}
                      >
                        {material.is_archived ? "Archived" : "Active"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="py-14 text-center text-muted-foreground" colSpan={7}>
                    No materials are linked to this supplier yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(parsed);
}
