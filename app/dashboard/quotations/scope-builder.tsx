"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateQuotationTotals,
  type CalculatedLabourItem,
  type CalculatedMaterialItem,
  type CalculatedScopeCharge,
  type CalculatedScope,
  type LabourItemInput,
  type MaterialItemInput,
  type ScopeChargeInput,
  type ScopeInput,
} from "@/lib/quotations/scope-calculations";
import { cn } from "@/lib/utils";

const inputClass =
  "h-9 rounded-md border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900";
const calculatedClass =
  "flex min-h-9 items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium tabular-nums text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-200";

function newMaterialItem(): MaterialItemInput {
  return {
    id: `new-${crypto.randomUUID()}`,
    is_persisted: false,
    material_description: "",
    material_category: "",
    supplier_name: "",
    supplier_quote_reference: "",
    quantity: "",
    unit_cost: "",
    profit_type: "percentage",
    profit_value: "0",
  };
}

function newLabourItem(): LabourItemInput {
  return {
    id: crypto.randomUUID(),
    labour_description: "",
    total_hours: "",
    number_of_workers: "",
    number_of_days: "",
    hours_per_day: "",
    work_type: "regular",
  };
}

function newScopeCharge(): ScopeChargeInput {
  return {
    id: `new-${crypto.randomUUID()}`,
    is_persisted: false,
    description: "",
    amount: "",
    profit_type: "percentage",
    profit_value: "0",
  };
}

function newScope(index: number): ScopeInput {
  return {
    id: crypto.randomUUID(),
    scope_title: `Scope of Work ${index + 1}`,
    scope_description: "",
    quantity: "1",
    labour_calculation_method: "hourly",
    regular_hourly_rate: "",
    overtime_hourly_rate: "",
    discount_type: "none",
    discount_value: "",
    material_items: [],
    labour_items: [],
    scope_charges: [],
  };
}

function formatCurrency(value: number | string | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(numberValue);
}

export function ScopeBuilder({
  quotationId,
  scopes,
  onChange,
}: {
  quotationId: string;
  scopes: ScopeInput[];
  onChange: (scopes: ScopeInput[]) => void;
}) {
  const [collapsedScopeIds, setCollapsedScopeIds] = useState<Set<string>>(
    new Set(),
  );
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [workingMaterialId, setWorkingMaterialId] = useState<string | null>(
    null,
  );
  const [workingChargeId, setWorkingChargeId] = useState<string | null>(null);
  const calculated = useMemo(() => calculateQuotationTotals(scopes), [scopes]);

  function updateScope(scopeIndex: number, updates: Partial<ScopeInput>) {
    onChange(
      scopes.map((scope, index) =>
        index === scopeIndex ? { ...scope, ...updates } : scope,
      ),
    );
  }

  function updateMaterial(
    scopeIndex: number,
    itemIndex: number,
    updates: Partial<MaterialItemInput>,
  ) {
    const materialItems = scopes[scopeIndex].material_items ?? [];
    updateScope(scopeIndex, {
      material_items: materialItems.map((item, index) =>
        index === itemIndex ? { ...item, ...updates } : item,
      ),
    });
  }

  function updateLabour(
    scopeIndex: number,
    itemIndex: number,
    updates: Partial<LabourItemInput>,
  ) {
    const labourItems = scopes[scopeIndex].labour_items ?? [];
    updateScope(scopeIndex, {
      labour_items: labourItems.map((item, index) =>
        index === itemIndex ? { ...item, ...updates } : item,
      ),
    });
  }

  function updateCharge(
    scopeIndex: number,
    chargeIndex: number,
    updates: Partial<ScopeChargeInput>,
  ) {
    const charges = scopes[scopeIndex].scope_charges ?? [];
    updateScope(scopeIndex, {
      scope_charges: charges.map((charge, index) =>
        index === chargeIndex ? { ...charge, ...updates } : charge,
      ),
    });
  }

  function toggleScope(scopeId: string) {
    setCollapsedScopeIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(scopeId)) {
        nextIds.delete(scopeId);
      } else {
        nextIds.add(scopeId);
      }

      return nextIds;
    });
  }

  async function uploadSupplierQuote(
    scopeIndex: number,
    itemIndex: number,
    file: File,
  ) {
    const item = scopes[scopeIndex].material_items?.[itemIndex];

    if (!item?.id || !item.is_persisted) {
      setDocumentError("Save the quotation before uploading a supplier PDF.");
      return;
    }

    const looksLikePdf =
      file.type === "application/pdf" ||
      file.type === "application/x-pdf" ||
      file.type === "application/octet-stream" ||
      file.type === "" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!looksLikePdf) {
      setDocumentError("Supplier quote must be a PDF.");
      return;
    }

    if (file.size === 0) {
      setDocumentError("Supplier quote PDF is empty.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDocumentError("Supplier quote PDF must be 10 MB or smaller.");
      return;
    }

    if (
      item.supplier_quote_document &&
      !window.confirm("Replace the existing supplier quote PDF?")
    ) {
      return;
    }

    setDocumentError(null);
    setWorkingMaterialId(item.id);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch(
        `/api/org/quotations/${quotationId}/materials/${item.id}/supplier-quote`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            document?: NonNullable<
              MaterialItemInput["supplier_quote_document"]
            >;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.document) {
        setDocumentError(payload?.error ?? "Unable to upload supplier quote.");
        return;
      }

      updateMaterial(scopeIndex, itemIndex, {
        is_persisted: true,
        supplier_quote_document: payload.document,
      });
    } catch {
      setDocumentError("Unable to upload supplier quote.");
    } finally {
      setWorkingMaterialId(null);
    }
  }

  async function removeSupplierQuote(scopeIndex: number, itemIndex: number) {
    const item = scopes[scopeIndex].material_items?.[itemIndex];

    if (!item?.id || !item.supplier_quote_document) {
      return;
    }

    if (!window.confirm("Remove this supplier quote PDF?")) {
      return;
    }

    setDocumentError(null);
    setWorkingMaterialId(item.id);

    try {
      const response = await fetch(
        `/api/org/quotations/${quotationId}/materials/${item.id}/supplier-quote`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setDocumentError(payload?.error ?? "Unable to remove supplier quote.");
        return;
      }

      updateMaterial(scopeIndex, itemIndex, {
        supplier_quote_document: null,
      });
    } catch {
      setDocumentError("Unable to remove supplier quote.");
    } finally {
      setWorkingMaterialId(null);
    }
  }

  async function uploadChargeDocument(
    scopeIndex: number,
    chargeIndex: number,
    file: File,
  ) {
    const charge = scopes[scopeIndex].scope_charges?.[chargeIndex];

    if (!charge?.id || !charge.is_persisted) {
      setDocumentError("Save the quotation before uploading a supporting PDF.");
      return;
    }

    if (file.type !== "application/pdf") {
      setDocumentError("Supporting document must be a PDF.");
      return;
    }

    if (file.size === 0) {
      setDocumentError("Supporting PDF is empty.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDocumentError("Supporting PDF must be 10 MB or smaller.");
      return;
    }

    if (
      charge.supporting_document &&
      !window.confirm("Replace the existing supporting PDF?")
    ) {
      return;
    }

    setDocumentError(null);
    setWorkingChargeId(charge.id);

    try {
      const formData = new FormData();
      formData.set("file", file);

      const response = await fetch(
        `/api/org/quotations/${quotationId}/scope-charges/${charge.id}/document`,
        {
          method: "POST",
          body: formData,
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            document?: NonNullable<ScopeChargeInput["supporting_document"]>;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.document) {
        setDocumentError(
          payload?.error ?? "Unable to upload supporting document.",
        );
        return;
      }

      updateCharge(scopeIndex, chargeIndex, {
        is_persisted: true,
        supporting_document: payload.document,
      });
    } catch {
      setDocumentError("Unable to upload supporting document.");
    } finally {
      setWorkingChargeId(null);
    }
  }

  async function removeChargeDocument(
    scopeIndex: number,
    chargeIndex: number,
  ) {
    const charge = scopes[scopeIndex].scope_charges?.[chargeIndex];

    if (!charge?.id || !charge.supporting_document) {
      return;
    }

    if (!window.confirm("Remove this supporting PDF?")) {
      return;
    }

    setDocumentError(null);
    setWorkingChargeId(charge.id);

    try {
      const response = await fetch(
        `/api/org/quotations/${quotationId}/scope-charges/${charge.id}/document`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setDocumentError(
          payload?.error ?? "Unable to remove supporting document.",
        );
        return;
      }

      updateCharge(scopeIndex, chargeIndex, {
        supporting_document: null,
      });
    } catch {
      setDocumentError("Unable to remove supporting document.");
    } finally {
      setWorkingChargeId(null);
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {documentError ? (
          <div
            className="sticky top-20 z-30 flex items-start justify-between gap-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm dark:border-red-900/60 dark:bg-red-950 dark:text-red-200"
            role="alert"
          >
            <span>{documentError}</span>
            <button
              className="shrink-0 font-medium hover:underline"
              type="button"
              onClick={() => setDocumentError(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Scope Builder
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Build the materials, labour, and charges included in this quote.
            </p>
          </div>
          <Button
            className="h-9 w-full rounded-md sm:w-auto"
            type="button"
            onClick={() => onChange([...scopes, newScope(scopes.length)])}
          >
            <PlusIcon data-icon="inline-start" />
            Add Scope of Work
          </Button>
        </div>

        {scopes.length === 0 ? (
          <EmptyTabState
            actionLabel="Add first scope"
            message="Add a scope of work to begin building this quotation."
            onAction={() => onChange([newScope(0)])}
          />
        ) : null}

        {scopes.map((scope, scopeIndex) => {
          const scopeId = scope.id ?? String(scopeIndex);
          const isCollapsed = collapsedScopeIds.has(scopeId);
          const calculatedScope = calculated.scopes[scopeIndex];

          return (
            <article
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              key={scopeId}
            >
              <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800 sm:px-5">
                <Button
                  aria-expanded={!isCollapsed}
                  className="size-8 rounded-md"
                  size="icon-sm"
                  title={isCollapsed ? "Expand scope" : "Collapse scope"}
                  type="button"
                  variant="ghost"
                  onClick={() => toggleScope(scopeId)}
                >
                  {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
                  <span className="sr-only">
                    {isCollapsed ? "Expand scope" : "Collapse scope"}
                  </span>
                </Button>
                <button
                  className="min-w-0 flex-1 text-left"
                  type="button"
                  onClick={() => toggleScope(scopeId)}
                >
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Scope {scopeIndex + 1}
                  </p>
                  <h3 className="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    {scope.scope_title || `Scope of Work ${scopeIndex + 1}`}
                  </h3>
                </button>
                <div className="hidden text-right sm:block">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Scope total
                  </p>
                  <p className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                    {formatCurrency(calculatedScope?.scope_total_after_discount)}
                  </p>
                </div>
                <ConfirmDeleteButton
                  description={`This will remove Scope ${scopeIndex + 1} and all of its material, labour, and charge rows.`}
                  label="Delete scope"
                  onConfirm={() =>
                    onChange(scopes.filter((_, index) => index !== scopeIndex))
                  }
                />
              </div>

              {isCollapsed ? (
                <div className="flex items-center justify-between px-4 py-3 sm:hidden">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Scope total
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
                    {formatCurrency(calculatedScope?.scope_total_after_discount)}
                  </span>
                </div>
              ) : (
                <div className="space-y-5 p-4 sm:p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-4">
                      <Field label="Scope Title">
                        <Input
                          className={inputClass}
                          value={scope.scope_title ?? ""}
                          onChange={(event) =>
                            updateScope(scopeIndex, {
                              scope_title: event.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Quantity">
                        <NumberInput
                          className="max-w-48"
                          required
                          value={scope.quantity ?? 1}
                          onChange={(value) =>
                            updateScope(scopeIndex, { quantity: value })
                          }
                        />
                        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          Number of units included in this scope estimate
                        </p>
                      </Field>
                    </div>
                    <div className="md:row-span-2">
                      <Field label="Scope Description">
                        <Textarea
                          className="min-h-28 rounded-md border-zinc-300 bg-white text-sm dark:border-zinc-700 dark:bg-zinc-900"
                          value={scope.scope_description ?? ""}
                          onChange={(event) =>
                            updateScope(scopeIndex, {
                              scope_description: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                  </div>

                  <Tabs defaultValue="materials">
                    <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md bg-zinc-100 p-1 dark:bg-zinc-900">
                      <TabsTrigger
                        className="h-8 flex-none rounded-sm px-3"
                        value="materials"
                      >
                        Materials
                        <TabCount value={scope.material_items?.length ?? 0} />
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-8 flex-none rounded-sm px-3"
                        value="labour"
                      >
                        Labour
                        <TabCount value={scope.labour_items?.length ?? 0} />
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-8 flex-none rounded-sm px-3"
                        value="charges"
                      >
                        Additional Charges
                        <TabCount value={scope.scope_charges?.length ?? 0} />
                      </TabsTrigger>
                      <TabsTrigger
                        className="h-8 flex-none rounded-sm px-3"
                        value="summary"
                      >
                        Summary
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent className="pt-4" value="materials">
                      <MaterialSection
                        calculatedItems={calculatedScope?.material_items ?? []}
                        items={scope.material_items ?? []}
                        workingMaterialId={workingMaterialId}
                        onAdd={() =>
                          updateScope(scopeIndex, {
                            material_items: [
                              ...(scope.material_items ?? []),
                              newMaterialItem(),
                            ],
                          })
                        }
                        onDelete={(itemIndex) =>
                          updateScope(scopeIndex, {
                            material_items: (
                              scope.material_items ?? []
                            ).filter((_, index) => index !== itemIndex),
                          })
                        }
                        onRemoveDocument={(itemIndex) =>
                          void removeSupplierQuote(scopeIndex, itemIndex)
                        }
                        onUpdate={(itemIndex, updates) =>
                          updateMaterial(scopeIndex, itemIndex, updates)
                        }
                        onUpload={(itemIndex, file) =>
                          void uploadSupplierQuote(
                            scopeIndex,
                            itemIndex,
                            file,
                          )
                        }
                      />
                    </TabsContent>

                    <TabsContent className="pt-4" value="labour">
                      <LabourSection
                        calculatedScope={calculatedScope}
                        items={scope.labour_items ?? []}
                        method={scope.labour_calculation_method ?? "hourly"}
                        overtimeRate={scope.overtime_hourly_rate}
                        regularRate={scope.regular_hourly_rate}
                        onAdd={() =>
                          updateScope(scopeIndex, {
                            labour_items: [
                              ...(scope.labour_items ?? []),
                              newLabourItem(),
                            ],
                          })
                        }
                        onDelete={(itemIndex) =>
                          updateScope(scopeIndex, {
                            labour_items: (scope.labour_items ?? []).filter(
                              (_, index) => index !== itemIndex,
                            ),
                          })
                        }
                        onMethodChange={(value) =>
                          updateScope(scopeIndex, {
                            labour_calculation_method: value,
                          })
                        }
                        onOvertimeRateChange={(value) =>
                          updateScope(scopeIndex, {
                            overtime_hourly_rate: value,
                          })
                        }
                        onRegularRateChange={(value) =>
                          updateScope(scopeIndex, {
                            regular_hourly_rate: value,
                          })
                        }
                        onUpdate={(itemIndex, updates) =>
                          updateLabour(scopeIndex, itemIndex, updates)
                        }
                      />
                    </TabsContent>

                    <TabsContent className="pt-4" value="charges">
                      <ChargesSection
                        calculatedCharges={
                          calculatedScope?.scope_charges ?? []
                        }
                        charges={scope.scope_charges ?? []}
                        workingChargeId={workingChargeId}
                        onAdd={() =>
                          updateScope(scopeIndex, {
                            scope_charges: [
                              ...(scope.scope_charges ?? []),
                              newScopeCharge(),
                            ],
                          })
                        }
                        onDelete={(chargeIndex) =>
                          updateScope(scopeIndex, {
                            scope_charges: (scope.scope_charges ?? []).filter(
                              (_, index) => index !== chargeIndex,
                            ),
                          })
                        }
                        onRemoveDocument={(chargeIndex) =>
                          void removeChargeDocument(scopeIndex, chargeIndex)
                        }
                        onUpdate={(chargeIndex, updates) =>
                          updateCharge(scopeIndex, chargeIndex, updates)
                        }
                        onUpload={(chargeIndex, file) =>
                          void uploadChargeDocument(
                            scopeIndex,
                            chargeIndex,
                            file,
                          )
                        }
                      />
                    </TabsContent>

                    <TabsContent className="pt-4" value="summary">
                      <ScopeSummary
                        calculatedScope={calculatedScope}
                        quantity={scope.quantity}
                        discountType={scope.discount_type ?? "none"}
                        discountValue={scope.discount_value}
                        onDiscountTypeChange={(value) =>
                          updateScope(scopeIndex, { discount_type: value })
                        }
                        onDiscountValueChange={(value) =>
                          updateScope(scopeIndex, { discount_value: value })
                        }
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Live quotation totals
              </p>
              <h2 className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                Draft Summary
              </h2>
            </div>
            <Badge
              className="rounded-md border-zinc-200 dark:border-zinc-700"
              variant="outline"
            >
              {scopes.length} {scopes.length === 1 ? "scope" : "scopes"}
            </Badge>
          </div>
          <div className="mt-5 space-y-3">
            <SummaryLine
              label="Material Total"
              value={formatCurrency(calculated.totals.material_total)}
            />
            <SummaryLine
              label="Material Profit"
              value={formatCurrency(calculated.totals.material_profit_total)}
            />
            <SummaryLine
              label="Labour Total"
              value={formatCurrency(calculated.totals.labour_total)}
            />
            <SummaryLine
              label="Additional Charges"
              value={formatCurrency(
                calculated.totals.scope_additional_charges_total,
              )}
            />
            <SummaryLine
              label="Discounts"
              value={`-${formatCurrency(calculated.totals.scopes_discount_total)}`}
            />
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <SummaryLine
                label="Draft Subtotal"
                strong
                value={formatCurrency(calculated.totals.grand_total_before_tax)}
              />
            </div>
          </div>
          <Button className="mt-5 h-10 w-full rounded-md" type="submit">
            <SaveIcon data-icon="inline-start" />
            Save Draft
          </Button>
        </div>
      </aside>
    </section>
  );
}

function MaterialSection({
  items,
  calculatedItems,
  workingMaterialId,
  onAdd,
  onUpdate,
  onDelete,
  onUpload,
  onRemoveDocument,
}: {
  items: MaterialItemInput[];
  calculatedItems: CalculatedMaterialItem[];
  workingMaterialId: string | null;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<MaterialItemInput>) => void;
  onDelete: (index: number) => void;
  onUpload: (index: number, file: File) => void;
  onRemoveDocument: (index: number) => void;
}) {
  return (
    <TabSection
      actionLabel="Add Material"
      description="Enter supplier cost and margin details for each material."
      title="Material Cost"
      onAdd={onAdd}
    >
      {items.length === 0 ? (
        <EmptyTabState
          actionLabel="Add material"
          message="No material rows have been added to this scope."
          onAction={onAdd}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 lg:block">
            <Table className="min-w-[1480px]">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                <TableRow className="hover:bg-transparent">
                  {[
                    "Description",
                    "Category",
                    "Supplier",
                    "Quote Ref",
                    "Qty",
                    "Unit Cost",
                    "Material Cost",
                    "Profit Type",
                    "Profit Value",
                    "Profit",
                    "Line Total",
                    "Supplier PDF",
                    "",
                  ].map((header) => (
                    <TableHead
                      className="h-10 px-2 text-xs text-zinc-500 dark:text-zinc-400"
                      key={header || "actions"}
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, itemIndex) => {
                  const calculatedItem = calculatedItems[itemIndex];

                  return (
                    <TableRow className="align-top" key={item.id ?? itemIndex}>
                      <TableCell className="w-52 p-2">
                        <Input
                          aria-label="Material description"
                          className={inputClass}
                          value={item.material_description ?? ""}
                          onChange={(event) =>
                            onUpdate(itemIndex, {
                              material_description: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <Input
                          aria-label="Material category"
                          className={inputClass}
                          value={item.material_category ?? ""}
                          onChange={(event) =>
                            onUpdate(itemIndex, {
                              material_category: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-40 p-2">
                        <Input
                          aria-label="Supplier"
                          className={inputClass}
                          value={item.supplier_name ?? ""}
                          onChange={(event) =>
                            onUpdate(itemIndex, {
                              supplier_name: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <Input
                          aria-label="Supplier quote reference"
                          className={inputClass}
                          value={item.supplier_quote_reference ?? ""}
                          onChange={(event) =>
                            onUpdate(itemIndex, {
                              supplier_quote_reference: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-32 min-w-32 p-2">
                        <NumberInput
                          ariaLabel="Quantity"
                          className="min-w-28"
                          value={item.quantity}
                          onChange={(value) =>
                            onUpdate(itemIndex, { quantity: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-28 p-2">
                        <NumberInput
                          ariaLabel="Unit cost"
                          value={item.unit_cost}
                          onChange={(value) =>
                            onUpdate(itemIndex, { unit_cost: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-32 p-2">
                        <CalculatedValue
                          value={formatCurrency(calculatedItem?.material_cost)}
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <CompactSelect
                          ariaLabel="Profit type"
                          options={[
                            ["percentage", "Percentage"],
                            ["amount", "Amount"],
                          ]}
                          value={
                            item.profit_type === "amount"
                              ? "amount"
                              : "percentage"
                          }
                          onChange={(value) =>
                            onUpdate(itemIndex, { profit_type: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-28 p-2">
                        <NumberInput
                          ariaLabel="Profit value"
                          value={item.profit_value}
                          onChange={(value) =>
                            onUpdate(itemIndex, { profit_value: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-28 p-2">
                        <CalculatedValue
                          value={formatCurrency(calculatedItem?.profit_amount)}
                        />
                      </TableCell>
                      <TableCell className="w-32 p-2">
                        <CalculatedValue
                          strong
                          value={formatCurrency(calculatedItem?.line_total)}
                        />
                      </TableCell>
                      <TableCell className="w-56 p-2">
                        <SupplierQuoteCell
                          isWorking={workingMaterialId === item.id}
                          item={item}
                          onRemove={() => onRemoveDocument(itemIndex)}
                          onUpload={(file) => onUpload(itemIndex, file)}
                        />
                      </TableCell>
                      <TableCell className="w-12 p-2">
                        <ConfirmDeleteButton
                          description="This material row will be removed from the scope."
                          label="Delete material"
                          onConfirm={() => onDelete(itemIndex)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item, itemIndex) => {
              const calculatedItem = calculatedItems[itemIndex];

              return (
                <div
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  key={item.id ?? itemIndex}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Material {itemIndex + 1}
                    </p>
                    <ConfirmDeleteButton
                      description="This material row will be removed from the scope."
                      label="Delete material"
                      onConfirm={() => onDelete(itemIndex)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Material Description">
                        <Input
                          className={inputClass}
                          value={item.material_description ?? ""}
                          onChange={(event) =>
                            onUpdate(itemIndex, {
                              material_description: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Category">
                      <Input
                        className={inputClass}
                        value={item.material_category ?? ""}
                        onChange={(event) =>
                          onUpdate(itemIndex, {
                            material_category: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Supplier">
                      <Input
                        className={inputClass}
                        value={item.supplier_name ?? ""}
                        onChange={(event) =>
                          onUpdate(itemIndex, {
                            supplier_name: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Supplier Quote Ref">
                      <Input
                        className={inputClass}
                        value={item.supplier_quote_reference ?? ""}
                        onChange={(event) =>
                          onUpdate(itemIndex, {
                            supplier_quote_reference: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Quantity">
                      <NumberInput
                        value={item.quantity}
                        onChange={(value) =>
                          onUpdate(itemIndex, { quantity: value })
                        }
                      />
                    </Field>
                    <Field label="Unit Cost">
                      <NumberInput
                        value={item.unit_cost}
                        onChange={(value) =>
                          onUpdate(itemIndex, { unit_cost: value })
                        }
                      />
                    </Field>
                    <Field label="Profit Type">
                      <CompactSelect
                        options={[
                          ["percentage", "Percentage"],
                          ["amount", "Amount"],
                        ]}
                        value={
                          item.profit_type === "amount"
                            ? "amount"
                            : "percentage"
                        }
                        onChange={(value) =>
                          onUpdate(itemIndex, { profit_type: value })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        item.profit_type === "amount"
                          ? "Profit Amount"
                          : "Profit %"
                      }
                    >
                      <NumberInput
                        value={item.profit_value}
                        onChange={(value) =>
                          onUpdate(itemIndex, { profit_value: value })
                        }
                      />
                    </Field>
                    <Field label="Material Cost">
                      <CalculatedValue
                        value={formatCurrency(calculatedItem?.material_cost)}
                      />
                    </Field>
                    <Field label="Profit Amount">
                      <CalculatedValue
                        value={formatCurrency(calculatedItem?.profit_amount)}
                      />
                    </Field>
                    <Field label="Line Total">
                      <CalculatedValue
                        strong
                        value={formatCurrency(calculatedItem?.line_total)}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Supplier Quote PDF">
                        <SupplierQuoteCell
                          isWorking={workingMaterialId === item.id}
                          item={item}
                          onRemove={() => onRemoveDocument(itemIndex)}
                          onUpload={(file) => onUpload(itemIndex, file)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </TabSection>
  );
}

function LabourSection({
  items,
  calculatedScope,
  method,
  regularRate,
  overtimeRate,
  onAdd,
  onUpdate,
  onDelete,
  onMethodChange,
  onRegularRateChange,
  onOvertimeRateChange,
}: {
  items: LabourItemInput[];
  calculatedScope: CalculatedScope | undefined;
  method: string;
  regularRate: number | string | null | undefined;
  overtimeRate: number | string | null | undefined;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<LabourItemInput>) => void;
  onDelete: (index: number) => void;
  onMethodChange: (value: string) => void;
  onRegularRateChange: (value: string) => void;
  onOvertimeRateChange: (value: string) => void;
}) {
  const isCrew = method === "crew";
  const regularHours = (calculatedScope?.labour_items ?? []).reduce(
    (sum, item) => sum + item.regular_hours,
    0,
  );
  const overtimeHours = (calculatedScope?.labour_items ?? []).reduce(
    (sum, item) => sum + item.overtime_hours,
    0,
  );

  return (
    <TabSection
      actionLabel="Add Labour"
      description="Choose a calculation method, set rates, and add labour rows."
      title="Labour Cost"
      onAdd={onAdd}
    >
      <div className="mb-4 grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <Label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Labour Calculation Method
          </Label>
          <div className="mt-2 inline-grid w-full grid-cols-2 rounded-md border border-zinc-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950 sm:w-auto">
            {[
              ["hourly", "Hourly Basis"],
              ["crew", "Crew Calculation"],
            ].map(([value, label]) => (
              <Button
                aria-pressed={method === value}
                className={cn(
                  "h-8 rounded-sm px-4",
                  method === value
                    ? "bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                    : "text-zinc-600 dark:text-zinc-300",
                )}
                key={value}
                type="button"
                variant={method === value ? "default" : "ghost"}
                onClick={() => onMethodChange(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Regular Hourly Rate">
            <NumberInput
              value={regularRate}
              onChange={onRegularRateChange}
            />
          </Field>
          <Field label="Overtime Hourly Rate">
            <NumberInput
              value={overtimeRate}
              onChange={onOvertimeRateChange}
            />
          </Field>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyTabState
          actionLabel="Add labour"
          message="No labour rows have been added to this scope."
          onAction={onAdd}
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 lg:block">
            <Table className="min-w-[1050px]">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 px-2 text-xs text-zinc-500">
                    Description
                  </TableHead>
                  {isCrew ? (
                    <>
                      <TableHead className="h-10 px-2 text-xs text-zinc-500">
                        Workers
                      </TableHead>
                      <TableHead className="h-10 px-2 text-xs text-zinc-500">
                        Days
                      </TableHead>
                      <TableHead className="h-10 px-2 text-xs text-zinc-500">
                        Hours/Day
                      </TableHead>
                    </>
                  ) : (
                    <TableHead className="h-10 px-2 text-xs text-zinc-500">
                      Total Hours
                    </TableHead>
                  )}
                  <TableHead className="h-10 px-2 text-xs text-zinc-500">
                    Work Type
                  </TableHead>
                  <TableHead className="h-10 px-2 text-xs text-zinc-500">
                    Regular Hours
                  </TableHead>
                  <TableHead className="h-10 px-2 text-xs text-zinc-500">
                    Overtime Hours
                  </TableHead>
                  <TableHead className="h-10 px-2 text-xs text-zinc-500">
                    Total Cost
                  </TableHead>
                  <TableHead className="h-10 w-12 px-2" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, itemIndex) => (
                  <LabourDesktopRow
                    calculatedItem={
                      calculatedScope?.labour_items[itemIndex]
                    }
                    isCrew={isCrew}
                    item={item}
                    key={item.id ?? itemIndex}
                    onDelete={() => onDelete(itemIndex)}
                    onUpdate={(updates) => onUpdate(itemIndex, updates)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {items.map((item, itemIndex) => (
              <LabourMobileCard
                calculatedItem={calculatedScope?.labour_items[itemIndex]}
                isCrew={isCrew}
                item={item}
                itemNumber={itemIndex + 1}
                key={item.id ?? itemIndex}
                onDelete={() => onDelete(itemIndex)}
                onUpdate={(updates) => onUpdate(itemIndex, updates)}
              />
            ))}
          </div>
        </>
      )}

      {isCrew ? (
        <div className="mt-4 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-3">
          <Metric label="Total Regular Hours" value={String(regularHours)} />
          <Metric label="Total Overtime Hours" value={String(overtimeHours)} />
          <Metric
            label="Total Labour Cost"
            strong
            value={formatCurrency(calculatedScope?.labour_total)}
          />
        </div>
      ) : null}
    </TabSection>
  );
}

function LabourDesktopRow({
  item,
  calculatedItem,
  isCrew,
  onUpdate,
  onDelete,
}: {
  item: LabourItemInput;
  calculatedItem: CalculatedLabourItem | undefined;
  isCrew: boolean;
  onUpdate: (updates: Partial<LabourItemInput>) => void;
  onDelete: () => void;
}) {
  return (
    <TableRow className="align-top">
      <TableCell className="w-64 p-2">
        <Input
          aria-label="Labour description"
          className={inputClass}
          value={item.labour_description ?? ""}
          onChange={(event) =>
            onUpdate({ labour_description: event.target.value })
          }
        />
      </TableCell>
      {isCrew ? (
        <>
          <TableCell className="w-24 p-2">
            <NumberInput
              ariaLabel="Number of workers"
              value={item.number_of_workers}
              onChange={(value) => onUpdate({ number_of_workers: value })}
            />
          </TableCell>
          <TableCell className="w-24 p-2">
            <NumberInput
              ariaLabel="Number of days"
              value={item.number_of_days}
              onChange={(value) => onUpdate({ number_of_days: value })}
            />
          </TableCell>
          <TableCell className="w-24 p-2">
            <NumberInput
              ariaLabel="Hours per day"
              value={item.hours_per_day}
              onChange={(value) => onUpdate({ hours_per_day: value })}
            />
          </TableCell>
        </>
      ) : (
        <TableCell className="w-28 p-2">
          <NumberInput
            ariaLabel="Total hours"
            value={item.total_hours}
            onChange={(value) => onUpdate({ total_hours: value })}
          />
        </TableCell>
      )}
      <TableCell className="w-40 p-2">
        <WorkTypeSelect
          value={item.work_type ?? "regular"}
          onChange={(value) => onUpdate({ work_type: value })}
        />
      </TableCell>
      <TableCell className="w-32 p-2">
        <CalculatedValue value={String(calculatedItem?.regular_hours ?? 0)} />
      </TableCell>
      <TableCell className="w-32 p-2">
        <CalculatedValue value={String(calculatedItem?.overtime_hours ?? 0)} />
      </TableCell>
      <TableCell className="w-32 p-2">
        <CalculatedValue
          strong
          value={formatCurrency(calculatedItem?.total_cost)}
        />
      </TableCell>
      <TableCell className="w-12 p-2">
        <ConfirmDeleteButton
          description="This labour row will be removed from the scope."
          label="Delete labour"
          onConfirm={onDelete}
        />
      </TableCell>
    </TableRow>
  );
}

function LabourMobileCard({
  item,
  calculatedItem,
  itemNumber,
  isCrew,
  onUpdate,
  onDelete,
}: {
  item: LabourItemInput;
  calculatedItem: CalculatedLabourItem | undefined;
  itemNumber: number;
  isCrew: boolean;
  onUpdate: (updates: Partial<LabourItemInput>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Labour {itemNumber}
        </p>
        <ConfirmDeleteButton
          description="This labour row will be removed from the scope."
          label="Delete labour"
          onConfirm={onDelete}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Labour Description">
            <Input
              className={inputClass}
              value={item.labour_description ?? ""}
              onChange={(event) =>
                onUpdate({ labour_description: event.target.value })
              }
            />
          </Field>
        </div>
        {isCrew ? (
          <>
            <Field label="Number of Workers">
              <NumberInput
                value={item.number_of_workers}
                onChange={(value) => onUpdate({ number_of_workers: value })}
              />
            </Field>
            <Field label="Number of Days">
              <NumberInput
                value={item.number_of_days}
                onChange={(value) => onUpdate({ number_of_days: value })}
              />
            </Field>
            <Field label="Hours Per Day">
              <NumberInput
                value={item.hours_per_day}
                onChange={(value) => onUpdate({ hours_per_day: value })}
              />
            </Field>
          </>
        ) : (
          <Field label="Total Hours">
            <NumberInput
              value={item.total_hours}
              onChange={(value) => onUpdate({ total_hours: value })}
            />
          </Field>
        )}
        <Field label="Work Type">
          <WorkTypeSelect
            value={item.work_type ?? "regular"}
            onChange={(value) => onUpdate({ work_type: value })}
          />
        </Field>
        <Field label="Regular Hours">
          <CalculatedValue value={String(calculatedItem?.regular_hours ?? 0)} />
        </Field>
        <Field label="Overtime Hours">
          <CalculatedValue value={String(calculatedItem?.overtime_hours ?? 0)} />
        </Field>
        <Field label="Total Cost">
          <CalculatedValue
            strong
            value={formatCurrency(calculatedItem?.total_cost)}
          />
        </Field>
      </div>
    </div>
  );
}

function ChargesSection({
  charges,
  calculatedCharges,
  workingChargeId,
  onAdd,
  onUpdate,
  onDelete,
  onUpload,
  onRemoveDocument,
}: {
  charges: ScopeChargeInput[];
  calculatedCharges: CalculatedScopeCharge[];
  workingChargeId: string | null;
  onAdd: () => void;
  onUpdate: (index: number, updates: Partial<ScopeChargeInput>) => void;
  onDelete: (index: number) => void;
  onUpload: (index: number, file: File) => void;
  onRemoveDocument: (index: number) => void;
}) {
  return (
    <TabSection
      actionLabel="Add Charge"
      description="Add scope-specific costs such as freight, travel, or rentals."
      title="Additional Charges"
      onAdd={onAdd}
    >
      {charges.length === 0 ? (
        <EmptyTabState
          actionLabel="Add charge"
          message="No additional charges have been added to this scope."
          onAction={onAdd}
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800 lg:block">
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-zinc-50 dark:bg-zinc-900/80">
                <TableRow className="hover:bg-transparent">
                  {[
                    "Description",
                    "Base Amount",
                    "Profit Type",
                    "Profit Value",
                    "Profit Amount",
                    "Line Total",
                    "Supporting PDF",
                    "",
                  ].map((header) => (
                    <TableHead
                      className="h-10 px-2 text-xs text-zinc-500 dark:text-zinc-400"
                      key={header || "actions"}
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {charges.map((charge, chargeIndex) => {
                  const calculatedCharge = calculatedCharges[chargeIndex];

                  return (
                    <TableRow
                      className="align-top"
                      key={charge.id ?? chargeIndex}
                    >
                      <TableCell className="min-w-64 p-2">
                        <Input
                          aria-label="Additional charge description"
                          className={inputClass}
                          placeholder="e.g. Freight, crane rental, travel"
                          value={charge.description ?? ""}
                          onChange={(event) =>
                            onUpdate(chargeIndex, {
                              description: event.target.value,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <NumberInput
                          ariaLabel="Additional charge amount"
                          value={charge.amount}
                          onChange={(value) =>
                            onUpdate(chargeIndex, { amount: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-40 p-2">
                        <CompactSelect
                          ariaLabel="Additional charge profit type"
                          options={[
                            ["percentage", "Percentage"],
                            ["amount", "Amount"],
                          ]}
                          value={
                            charge.profit_type === "amount"
                              ? "amount"
                              : "percentage"
                          }
                          onChange={(value) =>
                            onUpdate(chargeIndex, { profit_type: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <NumberInput
                          ariaLabel={
                            charge.profit_type === "amount"
                              ? "Additional charge profit amount"
                              : "Additional charge profit percentage"
                          }
                          value={charge.profit_value}
                          onChange={(value) =>
                            onUpdate(chargeIndex, { profit_value: value })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <CalculatedValue
                          value={formatCurrency(
                            calculatedCharge?.profit_amount,
                          )}
                        />
                      </TableCell>
                      <TableCell className="w-36 p-2">
                        <CalculatedValue
                          strong
                          value={formatCurrency(calculatedCharge?.line_total)}
                        />
                      </TableCell>
                      <TableCell className="w-60 p-2">
                        <ChargeDocumentCell
                          charge={charge}
                          isWorking={workingChargeId === charge.id}
                          onRemove={() => onRemoveDocument(chargeIndex)}
                          onUpload={(file) => onUpload(chargeIndex, file)}
                        />
                      </TableCell>
                      <TableCell className="w-12 p-2">
                        <ConfirmDeleteButton
                          description="This additional charge and its supporting PDF will be removed from the scope."
                          label="Delete charge"
                          onConfirm={() => onDelete(chargeIndex)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {charges.map((charge, chargeIndex) => {
              const calculatedCharge = calculatedCharges[chargeIndex];

              return (
                <div
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  key={charge.id ?? chargeIndex}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Additional Charge {chargeIndex + 1}
                    </p>
                    <ConfirmDeleteButton
                      description="This additional charge and its supporting PDF will be removed from the scope."
                      label="Delete charge"
                      onConfirm={() => onDelete(chargeIndex)}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Field label="Description">
                        <Input
                          className={inputClass}
                          placeholder="e.g. Freight, crane rental, travel"
                          value={charge.description ?? ""}
                          onChange={(event) =>
                            onUpdate(chargeIndex, {
                              description: event.target.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Base Amount">
                      <NumberInput
                        value={charge.amount}
                        onChange={(value) =>
                          onUpdate(chargeIndex, { amount: value })
                        }
                      />
                    </Field>
                    <Field label="Profit Type">
                      <CompactSelect
                        options={[
                          ["percentage", "Percentage"],
                          ["amount", "Amount"],
                        ]}
                        value={
                          charge.profit_type === "amount"
                            ? "amount"
                            : "percentage"
                        }
                        onChange={(value) =>
                          onUpdate(chargeIndex, { profit_type: value })
                        }
                      />
                    </Field>
                    <Field
                      label={
                        charge.profit_type === "amount"
                          ? "Profit Amount"
                          : "Profit %"
                      }
                    >
                      <NumberInput
                        value={charge.profit_value}
                        onChange={(value) =>
                          onUpdate(chargeIndex, { profit_value: value })
                        }
                      />
                    </Field>
                    <Field label="Calculated Profit">
                      <CalculatedValue
                        value={formatCurrency(calculatedCharge?.profit_amount)}
                      />
                    </Field>
                    <Field label="Line Total">
                      <CalculatedValue
                        strong
                        value={formatCurrency(calculatedCharge?.line_total)}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Supporting PDF">
                        <ChargeDocumentCell
                          charge={charge}
                          isWorking={workingChargeId === charge.id}
                          onRemove={() => onRemoveDocument(chargeIndex)}
                          onUpload={(file) => onUpload(chargeIndex, file)}
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </TabSection>
  );
}

function ScopeSummary({
  calculatedScope,
  quantity,
  discountType,
  discountValue,
  onDiscountTypeChange,
  onDiscountValueChange,
}: {
  calculatedScope: CalculatedScope | undefined;
  quantity: number | string | null | undefined;
  discountType: string;
  discountValue: number | string | null | undefined;
  onDiscountTypeChange: (value: string) => void;
  onDiscountValueChange: (value: string) => void;
}) {
  return (
    <section>
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Scope Summary
        </h4>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Review the scope totals and apply a scope-level discount.
        </p>
      </div>
      <div className="grid gap-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryTile
            label="Material Total"
            value={formatCurrency(calculatedScope?.material_total)}
          />
          <SummaryTile
            label="Material Profit"
            value={formatCurrency(calculatedScope?.material_profit_total)}
          />
          <SummaryTile
            label="Labour Total"
            value={formatCurrency(calculatedScope?.labour_total)}
          />
          <SummaryTile
            label="Additional Charges"
            value={formatCurrency(calculatedScope?.additional_charges_total)}
          />
          <SummaryTile
            label="Subtotal Before Discount"
            value={formatCurrency(
              calculatedScope?.scope_subtotal_before_discount,
            )}
          />
          <SummaryTile
            label="Discount"
            value={`-${formatCurrency(calculatedScope?.discount_amount)}`}
          />
          <SummaryTile
            label="Calculated Unit Price"
            value={formatCurrency(
              Number(calculatedScope?.scope_total_after_discount ?? 0) /
                (Number(quantity) > 0 ? Number(quantity) : 1),
            )}
          />
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="grid gap-4">
            <Field label="Discount Type">
              <CompactSelect
                options={[
                  ["none", "None"],
                  ["percentage", "Percentage"],
                  ["amount", "Amount"],
                ]}
                value={discountType}
                onChange={onDiscountTypeChange}
              />
            </Field>
            <Field label="Discount Value">
              <NumberInput
                value={discountValue}
                onChange={onDiscountValueChange}
              />
            </Field>
          </div>
          <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Scope Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
              {formatCurrency(calculatedScope?.scope_total_after_discount)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TabSection({
  title,
  description,
  actionLabel,
  onAdd,
  children,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {title}
          </h4>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <Button
          className="h-8 w-full rounded-md sm:w-auto"
          size="sm"
          type="button"
          variant="outline"
          onClick={onAdd}
        >
          <PlusIcon data-icon="inline-start" />
          {actionLabel}
        </Button>
      </div>
      {children}
    </section>
  );
}

function EmptyTabState({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      <Button
        className="mt-4 h-8 rounded-md"
        size="sm"
        type="button"
        variant="outline"
        onClick={onAction}
      >
        <PlusIcon data-icon="inline-start" />
        {actionLabel}
      </Button>
    </div>
  );
}

function Field({
  label,
  mobileOnlyLabel,
  children,
}: {
  label?: string;
  mobileOnlyLabel?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label ? (
        <Label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {label}
        </Label>
      ) : null}
      {mobileOnlyLabel ? (
        <Label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-300 md:hidden">
          {mobileOnlyLabel}
        </Label>
      ) : null}
      <div className={label ? "mt-2" : undefined}>{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  ariaLabel,
  className,
  required = false,
}: {
  value: number | string | null | undefined;
  onChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  required?: boolean;
}) {
  return (
    <Input
      aria-label={ariaLabel}
      className={cn(inputClass, className)}
      inputMode="decimal"
      required={required}
      type="text"
      value={String(value ?? "")}
      onChange={(event) => {
        const nextValue = event.target.value.trim();

        if (nextValue === "" || /^\d+(?:\.\d*)?$/.test(nextValue)) {
          onChange(nextValue);
        }
      }}
    />
  );
}

function CompactSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => onChange(String(nextValue ?? ""))}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-9 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function WorkTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <CompactSelect
      ariaLabel="Work type"
      options={[
        ["regular", "Regular"],
        ["overtime", "Overtime"],
        ["weekend", "Weekend"],
        ["confined_space", "Confined Space"],
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function CalculatedValue({
  value,
  strong,
}: {
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        calculatedClass,
        strong &&
          "border-zinc-300 bg-zinc-100 font-semibold text-zinc-950 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50",
      )}
    >
      {value}
    </div>
  );
}

function SupplierQuoteCell({
  item,
  isWorking,
  onUpload,
  onRemove,
}: {
  item: MaterialItemInput;
  isWorking: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const document = item.supplier_quote_document;

  if (!item.is_persisted) {
    return (
      <div className="flex min-h-9 items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <FileTextIcon className="size-3.5" />
        Available after save
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {document ? (
        <p className="mb-2 max-w-48 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {document.file_name}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {document?.signed_url ? (
          <Button
            className="h-8 rounded-md"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => window.open(document.signed_url ?? "", "_blank")}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            View
          </Button>
        ) : null}
        <label
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "h-8 cursor-pointer rounded-md",
            isWorking && "pointer-events-none opacity-50",
          )}
        >
          <UploadIcon className="size-4" />
          {isWorking ? "Uploading..." : document ? "Replace" : "Upload PDF"}
          <input
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={isWorking}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                onUpload(file);
              }
            }}
          />
        </label>
        {document ? (
          <Button
            className="h-8 rounded-md"
            disabled={isWorking}
            size="sm"
            type="button"
            variant="destructive"
            onClick={onRemove}
          >
            Remove PDF
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ChargeDocumentCell({
  charge,
  isWorking,
  onUpload,
  onRemove,
}: {
  charge: ScopeChargeInput;
  isWorking: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const document = charge.supporting_document;

  if (!charge.is_persisted) {
    return (
      <div>
        <div className="flex min-h-9 items-center gap-2 rounded-md border border-dashed border-zinc-300 px-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <FileTextIcon className="size-3.5" />
          Available after save
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Optional supporting PDF
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      {document ? (
        <p className="mb-2 max-w-52 truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">
          {document.file_name}
        </p>
      ) : (
        <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
          Optional supporting PDF
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {document?.signed_url ? (
          <Button
            className="h-8 rounded-md"
            size="sm"
            type="button"
            variant="outline"
            onClick={() => window.open(document.signed_url ?? "", "_blank")}
          >
            <ExternalLinkIcon data-icon="inline-start" />
            View
          </Button>
        ) : null}
        <label
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "h-8 cursor-pointer rounded-md",
            isWorking && "pointer-events-none opacity-50",
          )}
        >
          <UploadIcon className="size-4" />
          {isWorking ? "Uploading..." : document ? "Replace" : "Upload PDF"}
          <input
            accept=".pdf,application/pdf"
            className="sr-only"
            disabled={isWorking}
            type="file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";

              if (file) {
                onUpload(file);
              }
            }}
          />
        </label>
        {document ? (
          <Button
            className="h-8 rounded-md"
            disabled={isWorking}
            size="sm"
            type="button"
            variant="destructive"
            onClick={onRemove}
          >
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmDeleteButton({
  label,
  description,
  onConfirm,
}: {
  label: string;
  description: string;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="size-8 rounded-md text-zinc-500 hover:text-red-600 dark:text-zinc-400"
        size="icon-sm"
        title={label}
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        <span className="sr-only">{label}</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-5 rounded-lg" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Confirm deletion</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="rounded-md"
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-md"
              type="button"
              variant="destructive"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TabCount({ value }: { value: number }) {
  return (
    <span className="rounded-sm bg-zinc-200 px-1.5 py-0.5 text-[10px] leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
      {value}
    </span>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-200",
          strong && "font-semibold text-zinc-950 dark:text-zinc-50",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={cn(
          "font-medium tabular-nums text-zinc-700 dark:text-zinc-200",
          strong && "text-base font-semibold text-zinc-950 dark:text-zinc-50",
        )}
      >
        {value}
      </span>
    </div>
  );
}
