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
import type {
  SupplierPriceCategory,
  SupplierPriceMaterial,
} from "@/lib/supplier-price-library/types";

import { ModuleHeader } from "../../module-tabs";

export function CategoryDetailClient({ categoryId }: { categoryId: string }) {
  const [category, setCategory] = useState<SupplierPriceCategory | null>(null);
  const [materials, setMaterials] = useState<SupplierPriceMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategory() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/org/supplier-price-library/categories/${categoryId}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | {
              category?: SupplierPriceCategory;
              materials?: SupplierPriceMaterial[];
              error?: string;
            }
          | null;
        if (!response.ok || !payload?.category) {
          throw new Error(payload?.error ?? "Unable to load category.");
        }
        setCategory(payload.category);
        setMaterials(payload.materials ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load category.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadCategory();
    return () => controller.abort();
  }, [categoryId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModuleHeader
        description="Category information and every material assigned to it."
        title={category?.category_name ?? "Category Details"}
      />
      <Button
        nativeButton={false}
        render={<Link href="/dashboard/supplier-price-library/categories" />}
        variant="ghost"
      >
        <ArrowLeftIcon /> Back to Categories
      </Button>

      {error ? (
        <div className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {category ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Category Information</CardTitle>
            <Badge variant={category.is_archived ? "outline" : "secondary"}>
              {category.is_archived ? "Archived" : "Active"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-3">
            <Detail label="Category Name" value={category.category_name} />
            <Detail label="Date Added" value={formatDate(category.created_at)} />
            <Detail label="Last Updated" value={formatDate(category.updated_at)} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Materials ({materials.length})</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Active and archived materials assigned to this category.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Size / Specification</TableHead>
                <TableHead>Grade / Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
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
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      {material.material_description}
                    </TableCell>
                    <TableCell>{material.size_specification ?? "—"}</TableCell>
                    <TableCell>{material.grade_material_type ?? "—"}</TableCell>
                    <TableCell>{material.unit_of_measure}</TableCell>
                    <TableCell>
                      <Badge
                        variant={material.is_archived ? "outline" : "secondary"}
                      >
                        {material.is_archived ? "Archived" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(material.updated_at)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="py-14 text-center text-muted-foreground" colSpan={7}>
                    No materials are assigned to this category yet.
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
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
