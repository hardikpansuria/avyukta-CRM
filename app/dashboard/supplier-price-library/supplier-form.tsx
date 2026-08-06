"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type { SupplierPriceSupplier } from "@/lib/supplier-price-library/types";

export type SupplierFormValue = {
  company_name: string;
  contact_person: string;
  company_address: string;
  email_address: string;
  contact_number: string;
};

export const emptySupplierForm: SupplierFormValue = {
  company_name: "",
  contact_person: "",
  company_address: "",
  email_address: "",
  contact_number: "",
};

export async function saveSupplier(
  form: SupplierFormValue,
  supplierId?: string,
) {
  const response = await fetch(
    supplierId
      ? `/api/org/supplier-price-library/suppliers/${supplierId}`
      : "/api/org/supplier-price-library/suppliers",
    {
      method: supplierId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    },
  );
  const payload = (await response.json().catch(() => null)) as
    | { supplier?: SupplierPriceSupplier; error?: string }
    | null;
  if (!response.ok || !payload?.supplier) {
    throw new Error(payload?.error ?? "Unable to save supplier");
  }
  return payload.supplier;
}

export function SupplierFields({
  form,
  onChange,
}: {
  form: SupplierFormValue;
  onChange: (form: SupplierFormValue) => void;
}) {
  function update(key: keyof SupplierFormValue, value: string) {
    onChange({ ...form, [key]: value });
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        className="sm:col-span-2"
        label="Company Name"
        required
        value={form.company_name}
        onChange={(value) => update("company_name", value)}
      />
      <Field
        label="Contact Person"
        value={form.contact_person}
        onChange={(value) => update("contact_person", value)}
      />
      <Field
        label="Email Address"
        type="email"
        value={form.email_address}
        onChange={(value) => update("email_address", value)}
      />
      <Field
        label="Contact Number"
        value={form.contact_number}
        onChange={(value) => update("contact_number", value)}
      />
      <div className="sm:col-span-2">
        <Label>Company Address</Label>
        <Textarea
          className="mt-2"
          value={form.company_address}
          onChange={(event) => update("company_address", event.target.value)}
        />
      </div>
    </div>
  );
}

export function CreateSupplierDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (supplier: SupplierPriceSupplier) => void;
}) {
  const [form, setForm] = useState(emptySupplierForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const supplier = await saveSupplier(form);
      onCreated(supplier);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create supplier",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form className="space-y-5" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Create New Supplier</DialogTitle>
            <DialogDescription>
              This creates only a Supplier Price Library supplier profile.
            </DialogDescription>
          </DialogHeader>
          <SupplierFields form={form} onChange={setForm} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <PlusIcon />
              {saving ? "Saving…" : "Save Supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  className,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange">) {
  return (
    <div className={className}>
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
