"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import type { SupplierPriceSupplier } from "@/lib/supplier-price-library/types";
import { CreateSupplierDialog } from "./supplier-form";

export type SupplierPriceDraft = {
  supplier_id: string;
  supplier_quote_number: string;
  unit_price: string;
  currency: string;
  quote_date: string;
  price_valid_until: string;
  notes: string;
};

export function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function emptyPriceDraft(): SupplierPriceDraft {
  return {
    supplier_id: "",
    supplier_quote_number: "",
    unit_price: "",
    currency: "CAD",
    quote_date: localDateValue(),
    price_valid_until: "",
    notes: "",
  };
}

export function PriceFormFields({
  draft,
  onChange,
  suppliers,
  onSupplierCreated,
  materialLabel,
}: {
  draft: SupplierPriceDraft;
  onChange: (draft: SupplierPriceDraft) => void;
  suppliers: SupplierPriceSupplier[];
  onSupplierCreated: (supplier: SupplierPriceSupplier) => void;
  materialLabel?: string;
}) {
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  function update(key: keyof SupplierPriceDraft, value: string) {
    onChange({ ...draft, [key]: value });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {materialLabel ? (
          <div className="sm:col-span-2">
            <Label>Material</Label>
            <Input className="mt-2" readOnly value={materialLabel} />
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Label>Supplier *</Label>
          <Select
            value={draft.supplier_id}
            onValueChange={(value) => {
              if (value === "__create_supplier") {
                setCreatingSupplier(true);
                return;
              }
              update("supplier_id", String(value));
            }}
          >
            <SelectTrigger className="mt-2 w-full">
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.company_name}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="__create_supplier">
                <PlusIcon /> Create New Supplier
              </SelectItem>
            </SelectContent>
          </Select>
          {!suppliers.length ? (
            <button
              className="mt-2 text-sm font-medium text-primary underline underline-offset-4"
              type="button"
              onClick={() => setCreatingSupplier(true)}
            >
              Create the first supplier
            </button>
          ) : null}
        </div>
        <Field
          label="Supplier Quote Number"
          value={draft.supplier_quote_number}
          onChange={(value) => update("supplier_quote_number", value)}
        />
        <Field
          label="Unit Price"
          min="0"
          required
          step="0.0001"
          type="number"
          value={draft.unit_price}
          onChange={(value) => update("unit_price", value)}
        />
        <Field
          label="Currency"
          maxLength={3}
          required
          value={draft.currency}
          onChange={(value) => update("currency", value.toUpperCase())}
        />
        <Field
          label="Quote Date"
          required
          type="date"
          value={draft.quote_date}
          onChange={(value) => update("quote_date", value)}
        />
        <Field
          label="Price Valid Until"
          min={draft.quote_date}
          type="date"
          value={draft.price_valid_until}
          onChange={(value) => update("price_valid_until", value)}
        />
        <div className="sm:col-span-2">
          <Label>Price Notes</Label>
          <Textarea
            className="mt-2"
            value={draft.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </div>
      </div>

      <CreateSupplierDialog
        key={creatingSupplier ? "open" : "closed"}
        open={creatingSupplier}
        onOpenChange={setCreatingSupplier}
        onCreated={(supplier) => {
          onSupplierCreated(supplier);
          update("supplier_id", supplier.id);
        }}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div>
      <Label>
        {label}
        {props.required ? " *" : ""}
      </Label>
      <Input
        className="mt-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </div>
  );
}
