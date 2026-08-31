"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftIcon, CopyIcon, PlusIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type {
  SupplierPriceCategory,
  SupplierPriceMaterial,
  SupplierPriceSupplier,
} from "@/lib/supplier-price-library/types";
import { CreateCategoryDialog } from "../category-form";
import {
  emptyPriceDraft,
  PriceFormFields,
  type SupplierPriceDraft,
} from "../price-form-fields";
import { ModuleHeader } from "../module-tabs";

const units = [
  "Each",
  "Foot",
  "Meter",
  "Pound",
  "Kilogram",
  "Sheet",
  "Plate",
  "Length",
  "Box",
  "Roll",
  "Litre",
  "Gallon",
];

type MaterialDraft = {
  category_id: string;
  material_description: string;
  size_specification: string;
  grade_material_type: string;
  unit_of_measure: string;
  notes: string;
};

const emptyMaterial: MaterialDraft = {
  category_id: "",
  material_description: "",
  size_specification: "",
  grade_material_type: "",
  unit_of_measure: "Each",
  notes: "",
};

export function MaterialForm({
  materialId,
  duplicateFrom,
}: {
  materialId?: string;
  duplicateFrom?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<MaterialDraft>(emptyMaterial);
  const [price, setPrice] = useState<SupplierPriceDraft>(emptyPriceDraft);
  const [addPrice, setAddPrice] = useState(!materialId);
  const [categories, setCategories] = useState<SupplierPriceCategory[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierPriceSupplier[]>([]);
  const [materialCode, setMaterialCode] = useState("");
  const [loading, setLoading] = useState(Boolean(materialId || duplicateFrom));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<string | null>(null);
  const [customUnit, setCustomUnit] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const selectedCategory = categories.find(
    (category) => category.id === form.category_id,
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/org/supplier-price-library/categories?status=active").then(
        (response) => response.json(),
      ),
      fetch(
        "/api/org/supplier-price-library/suppliers?status=active&pageSize=100",
      ).then((response) => response.json()),
      materialId || duplicateFrom
        ? fetch(
            `/api/org/supplier-price-library/materials/${materialId ?? duplicateFrom}`,
          ).then((response) => response.json())
        : Promise.resolve(null),
    ])
      .then(([categoryData, supplierData, materialData]) => {
        setCategories(categoryData.categories ?? []);
        setSuppliers(supplierData.suppliers ?? []);
        if (materialData?.material) {
          const material = materialData.material as SupplierPriceMaterial;
          setMaterialCode(material.material_code);
          setForm({
            category_id: material.category_id,
            material_description: material.material_description,
            size_specification: material.size_specification ?? "",
            grade_material_type: material.grade_material_type ?? "",
            unit_of_measure: material.unit_of_measure,
            notes: material.notes ?? "",
          });
          setCustomUnit(!units.includes(material.unit_of_measure));
        }
      })
      .catch(() => setError("Unable to load material form"))
      .finally(() => setLoading(false));
  }, [duplicateFrom, materialId]);

  function update(key: keyof MaterialDraft, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setExisting(null);

    const url = materialId
      ? `/api/org/supplier-price-library/materials/${materialId}`
      : duplicateFrom
        ? `/api/org/supplier-price-library/materials/${duplicateFrom}/duplicate`
        : "/api/org/supplier-price-library/materials";

    try {
      const response = await fetch(url, {
        method: materialId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          initial_price:
            !materialId && addPrice
              ? { ...price, unit_price: Number(price.unit_price) }
              : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.existingMaterialId) {
          setExisting(payload.existingMaterialId);
        }
        throw new Error(payload.error);
      }
      router.push(
        `/dashboard/supplier-price-library/materials/${payload.material.id}?created=1`,
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save material",
      );
    } finally {
      setSaving(false);
    }
  }

  const title = materialId
    ? "Edit Material"
    : duplicateFrom
      ? "Duplicate Material"
      : "New Material";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ModuleHeader
        title={title}
        description={
          duplicateFrom
            ? "Change at least one identifying field. Existing supplier prices are not copied."
            : "Create one master material and optionally record its first supplier price."
        }
      />
      <Button
        nativeButton={false}
        variant="ghost"
        render={
          <Link
            href={
              materialId
                ? `/dashboard/supplier-price-library/materials/${materialId}`
                : "/dashboard/supplier-price-library/materials"
            }
          />
        }
      >
        <ArrowLeftIcon /> Back
      </Button>

      {loading ? (
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-40" />
          </CardContent>
        </Card>
      ) : (
        <form className="space-y-6" onSubmit={submit}>
          <Card>
            <CardHeader>
              <CardTitle>Section A — Material Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Material Code</Label>
                <Input
                  className="mt-2"
                  readOnly
                  value={materialCode || "Generated automatically on save"}
                />
              </div>
              <div>
                <Label required>Category</Label>
                <Select
                  value={form.category_id}
                  onValueChange={(value) => {
                    if (value === "__create_category") {
                      setCreatingCategory(true);
                      return;
                    }
                    update("category_id", String(value));
                  }}
                  >
                  <SelectTrigger className="mt-2 w-full">
                    <SelectValue>
                      {selectedCategory?.category_name ?? "Select category"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.category_name}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="__create_category">
                      <PlusIcon /> Create New Category
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label required>Material Description</Label>
                <Input
                  className="mt-2"
                  required
                  value={form.material_description}
                  onChange={(event) =>
                    update("material_description", event.target.value)
                  }
                />
              </div>
              <MaterialField
                label="Size / Specification"
                value={form.size_specification}
                onChange={(value) => update("size_specification", value)}
              />
              <MaterialField
                label="Grade / Material Type"
                value={form.grade_material_type}
                onChange={(value) => update("grade_material_type", value)}
              />
              <div>
                <Label required>Unit of Measure</Label>
                {customUnit ? (
                  <div className="mt-2 flex gap-2">
                    <Input
                      required
                      value={form.unit_of_measure}
                      onChange={(event) =>
                        update("unit_of_measure", event.target.value)
                      }
                      placeholder="Custom unit"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCustomUnit(false);
                        update("unit_of_measure", "Each");
                      }}
                    >
                      Common units
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={form.unit_of_measure}
                    onValueChange={(value) => {
                      if (value === "__other") {
                        setCustomUnit(true);
                        update("unit_of_measure", "");
                      } else {
                        update("unit_of_measure", String(value));
                      }
                    }}
                  >
                    <SelectTrigger className="mt-2 w-full">
                      <SelectValue>
                        {form.unit_of_measure || "Select unit of measure"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other">Other / custom</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  className="mt-2"
                  rows={4}
                  value={form.notes}
                  onChange={(event) => update("notes", event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {!materialId ? (
            <Card>
              <CardHeader>
                <CardTitle>Section B — Initial Supplier Price</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="flex items-center gap-3 text-sm font-medium">
                  <Checkbox
                    checked={addPrice}
                    onChange={(event) => setAddPrice(event.target.checked)}
                  />
                  Add supplier price now
                </label>
                {addPrice ? (
                  <PriceFormFields
                    draft={price}
                    onChange={setPrice}
                    suppliers={suppliers}
                    onSupplierCreated={(supplier) =>
                      setSuppliers((current) => [...current, supplier])
                    }
                  />
                ) : (
                  <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    Only the master material will be created. No empty price
                    record will be saved.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p>{error}</p>
              {existing ? (
                <Link
                  className="mt-2 inline-block font-medium underline"
                  href={`/dashboard/supplier-price-library/materials/${existing}`}
                >
                  Open existing material
                </Link>
              ) : null}
            </div>
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
                saving ||
                !form.category_id ||
                (!materialId && addPrice && !price.supplier_id)
              }
            >
              {duplicateFrom ? <CopyIcon /> : <SaveIcon />}
              {saving
                ? "Saving…"
                : duplicateFrom
                  ? "Create Duplicate"
                  : addPrice && !materialId
                    ? "Save Material and Price"
                    : "Save Material"}
            </Button>
          </div>
        </form>
      )}

      <CreateCategoryDialog
        key={creatingCategory ? "open" : "closed"}
        open={creatingCategory}
        onOpenChange={setCreatingCategory}
        onCreated={(category) => {
          setCategories((current) => [...current, category]);
          update("category_id", category.id);
        }}
      />
    </div>
  );
}

function MaterialField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
