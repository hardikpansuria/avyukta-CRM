"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  SupplierPriceMaterial,
  SupplierPriceSupplier,
} from "@/lib/supplier-price-library/types";
import {
  emptyPriceDraft,
  PriceFormFields,
} from "../../price-form-fields";
import { ModuleHeader } from "../../module-tabs";

export function NewPriceForm({ initialMaterialId }: { initialMaterialId: string }) {
  const router = useRouter();
  const [materials, setMaterials] = useState<SupplierPriceMaterial[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierPriceSupplier[]>([]);
  const [materialId, setMaterialId] = useState(initialMaterialId);
  const [draft, setDraft] = useState(emptyPriceDraft);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(
        "/api/org/supplier-price-library/materials?status=active&pageSize=100",
      ).then((response) => response.json()),
      fetch(
        "/api/org/supplier-price-library/suppliers?status=active&pageSize=100",
      ).then((response) => response.json()),
    ])
      .then(([materialData, supplierData]) => {
        setMaterials(materialData.materials ?? []);
        setSuppliers(supplierData.suppliers ?? []);
      })
      .catch(() => setError("Unable to load price form options"))
      .finally(() => setLoading(false));
  }, []);

  const material = useMemo(
    () => materials.find((item) => item.id === materialId) ?? null,
    [materialId, materials],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!materialId) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/org/supplier-price-library/materials/${materialId}/prices`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            unit_price: Number(draft.unit_price),
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      router.push(
        `/dashboard/supplier-price-library/materials/${materialId}?priceAdded=1`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to add supplier price",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ModuleHeader
        title="Add Supplier Price"
        description="Select a master material and add a new historical supplier price."
      />
      <Button
        nativeButton={false}
        variant="ghost"
        render={<Link href="/dashboard/supplier-price-library/materials" />}
      >
        <ArrowLeftIcon /> Back to Materials
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Supplier Price</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-52" />
            </div>
          ) : (
            <form className="space-y-6" onSubmit={submit}>
              <div>
                <Label required>Material</Label>
                <Select value={materialId} onValueChange={(value) => setMaterialId(String(value))}>
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue>
                      {material ? materialLabel(material) : "Select material"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {materialLabel(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!materials.length ? (
                  <Button
                    className="mt-3"
                    nativeButton={false}
                    variant="outline"
                    render={
                      <Link href="/dashboard/supplier-price-library/materials/new" />
                    }
                  >
                    <PlusIcon /> Create a Material First
                  </Button>
                ) : null}
              </div>

              <PriceFormFields
                draft={draft}
                onChange={setDraft}
                suppliers={suppliers}
                onSupplierCreated={(supplier) =>
                  setSuppliers((current) => [...current, supplier])
                }
                materialLabel={material ? materialLabel(material) : undefined}
              />

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button
                  nativeButton={false}
                  variant="outline"
                  render={<Link href="/dashboard/supplier-price-library/materials" />}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saving || !materialId || !draft.supplier_id || !draft.unit_price
                  }
                >
                  {saving ? "Saving…" : "Add Supplier Price"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function materialLabel(material: SupplierPriceMaterial) {
  return [
    material.material_code,
    material.material_description,
    material.size_specification,
    material.grade_material_type,
  ]
    .filter(Boolean)
    .join(" — ");
}
