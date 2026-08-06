"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  emptySupplierForm,
  saveSupplier,
  SupplierFields,
} from "../../supplier-form";
import { ModuleHeader } from "../../module-tabs";

export function NewSupplierForm() {
  const router = useRouter();
  const [form, setForm] = useState(emptySupplierForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await saveSupplier(form);
      router.push("/dashboard/supplier-price-library/suppliers?created=1");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save supplier");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ModuleHeader
        title="New Supplier"
        description="Create a supplier profile for the Supplier Price Library."
      />
      <Button
        nativeButton={false}
        variant="ghost"
        render={<Link href="/dashboard/supplier-price-library/suppliers" />}
      >
        <ArrowLeftIcon /> Back to Suppliers
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Supplier Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={submit}>
            <SupplierFields form={form} onChange={setForm} />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                render={<Link href="/dashboard/supplier-price-library/suppliers" />}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save Supplier"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
