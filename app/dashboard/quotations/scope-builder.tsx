"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import {
  calculateQuotationTotals,
  type LabourItemInput,
  type MaterialItemInput,
  type ScopeChargeInput,
  type ScopeInput,
} from "@/lib/quotations/scope-calculations";

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const textareaClass =
  "min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const labelClass = "text-sm font-medium text-zinc-800 dark:text-zinc-200";
const cardClass =
  "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

function newMaterialItem(): MaterialItemInput {
  return {
    id: crypto.randomUUID(),
    material_description: "",
    material_category: "",
    supplier_name: "",
    supplier_quote_reference: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    profit_type: "none",
    profit_value: "",
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
    id: crypto.randomUUID(),
    description: "",
    amount: "",
  };
}

function newScope(index: number): ScopeInput {
  return {
    id: crypto.randomUUID(),
    scope_title: `Scope of Work ${index + 1}`,
    scope_description: "",
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

function formatLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function ScopeBuilder({
  scopes,
  onChange,
}: {
  scopes: ScopeInput[];
  onChange: (scopes: ScopeInput[]) => void;
}) {
  const [collapsedScopeIds, setCollapsedScopeIds] = useState<Set<string>>(
    new Set(),
  );
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
    const scope = scopes[scopeIndex];
    const materialItems = scope.material_items ?? [];
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
    const scope = scopes[scopeIndex];
    const labourItems = scope.labour_items ?? [];
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
    const scope = scopes[scopeIndex];
    const charges = scope.scope_charges ?? [];
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

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Scope Builder
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Build materials, labour, and additional charges for this draft.
            </p>
          </div>
          <button
            className="inline-flex h-10 w-full items-center justify-center whitespace-nowrap rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 sm:w-auto"
            type="button"
            onClick={() => onChange([...scopes, newScope(scopes.length)])}
          >
            Add Scope of Work
          </button>
        </div>

        {scopes.length === 0 ? (
          <div className={cardClass}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No scopes added yet.
            </p>
          </div>
        ) : null}

        {scopes.map((scope, scopeIndex) => {
          const scopeId = scope.id ?? String(scopeIndex);
          const isCollapsed = collapsedScopeIds.has(scopeId);
          const calculatedScope = calculated.scopes[scopeIndex];

          return (
            <article className={cardClass} key={scopeId}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  className="text-left"
                  type="button"
                  onClick={() => toggleScope(scopeId)}
                >
                  <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                    Scope of Work {scopeIndex + 1}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {scope.scope_title || `Scope of Work ${scopeIndex + 1}`}
                  </h3>
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
                    {formatCurrency(calculatedScope?.scope_total_after_discount)}
                  </p>
                  <button
                    className="shrink-0 whitespace-nowrap rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                    type="button"
                    onClick={() =>
                      onChange(scopes.filter((_, index) => index !== scopeIndex))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>

              {!isCollapsed ? (
                <div className="mt-5 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Scope Title">
                      <input
                        className={inputClass}
                        value={scope.scope_title ?? ""}
                        onChange={(event) =>
                          updateScope(scopeIndex, {
                            scope_title: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Labour Calculation Method">
                      <select
                        className={inputClass}
                        value={scope.labour_calculation_method ?? "hourly"}
                        onChange={(event) =>
                          updateScope(scopeIndex, {
                            labour_calculation_method: event.target.value,
                          })
                        }
                      >
                        <option value="hourly">Hourly</option>
                        <option value="crew">Crew</option>
                      </select>
                    </Field>
                    <Field label="Regular Hourly Rate">
                      <input
                        className={inputClass}
                        min="0"
                        step="0.01"
                        type="number"
                        value={String(scope.regular_hourly_rate ?? "")}
                        onChange={(event) =>
                          updateScope(scopeIndex, {
                            regular_hourly_rate: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <Field label="Overtime Hourly Rate">
                      <input
                        className={inputClass}
                        min="0"
                        step="0.01"
                        type="number"
                        value={String(scope.overtime_hourly_rate ?? "")}
                        onChange={(event) =>
                          updateScope(scopeIndex, {
                            overtime_hourly_rate: event.target.value,
                          })
                        }
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Scope Description">
                        <textarea
                          className={textareaClass}
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

                  <BuilderSection
                    title="Material Cost"
                    onAdd={() =>
                      updateScope(scopeIndex, {
                        material_items: [
                          ...(scope.material_items ?? []),
                          newMaterialItem(),
                        ],
                      })
                    }
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1200px] text-left text-sm">
                        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">Description</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Supplier</th>
                            <th className="px-3 py-2">Quote Ref</th>
                            <th className="px-3 py-2">Qty</th>
                            <th className="px-3 py-2">Unit</th>
                            <th className="px-3 py-2">Unit Cost</th>
                            <th className="px-3 py-2">Material Cost</th>
                            <th className="px-3 py-2">Profit Type</th>
                            <th className="px-3 py-2">Profit Value</th>
                            <th className="px-3 py-2">Profit</th>
                            <th className="px-3 py-2">Line Total</th>
                            <th className="px-3 py-2">Supplier PDF</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {(scope.material_items ?? []).map((item, itemIndex) => {
                            const calculatedItem =
                              calculatedScope?.material_items[itemIndex];

                            return (
                              <tr key={item.id ?? itemIndex}>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.material_description ?? ""}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        material_description: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.material_category ?? ""}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        material_category: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.supplier_name ?? ""}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        supplier_name: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.supplier_quote_reference ?? ""}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        supplier_quote_reference:
                                          event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    min="0"
                                    step="0.01"
                                    type="number"
                                    value={String(item.quantity ?? "")}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        quantity: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.unit ?? ""}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        unit: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    min="0"
                                    step="0.01"
                                    type="number"
                                    value={String(item.unit_cost ?? "")}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        unit_cost: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {formatCurrency(
                                    calculatedItem?.material_cost,
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    className={inputClass}
                                    value={item.profit_type ?? "none"}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        profit_type: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="none">None</option>
                                    <option value="percentage">Percentage</option>
                                    <option value="amount">Amount</option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    min="0"
                                    step="0.01"
                                    type="number"
                                    value={String(item.profit_value ?? "")}
                                    onChange={(event) =>
                                      updateMaterial(scopeIndex, itemIndex, {
                                        profit_value: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {formatCurrency(calculatedItem?.profit_amount)}
                                </td>
                                <td className="px-3 py-2 font-semibold">
                                  {formatCurrency(calculatedItem?.line_total)}
                                </td>
                                <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">
                                  Coming in Phase 3
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    className="text-sm font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                                    type="button"
                                    onClick={() =>
                                      updateScope(scopeIndex, {
                                        material_items: (
                                          scope.material_items ?? []
                                        ).filter(
                                          (_, index) => index !== itemIndex,
                                        ),
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </BuilderSection>

                  <BuilderSection
                    title="Labour Cost"
                    onAdd={() =>
                      updateScope(scopeIndex, {
                        labour_items: [
                          ...(scope.labour_items ?? []),
                          newLabourItem(),
                        ],
                      })
                    }
                  >
                    <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                            Labour calculation method
                          </p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Crew mode adds workers, days, and hours per day.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:w-64">
                          {[
                            ["hourly", "Hourly"],
                            ["crew", "Crew"],
                          ].map(([value, label]) => (
                            <button
                              className={
                                scope.labour_calculation_method === value
                                  ? "h-10 whitespace-nowrap rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950"
                                  : "h-10 whitespace-nowrap rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-700 transition hover:bg-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-950"
                              }
                              key={value}
                              type="button"
                              onClick={() =>
                                updateScope(scopeIndex, {
                                  labour_calculation_method: value,
                                })
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1000px] text-left text-sm">
                        <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                          <tr>
                            <th className="px-3 py-2">Description</th>
                            {scope.labour_calculation_method === "crew" ? (
                              <>
                                <th className="px-3 py-2">Workers</th>
                                <th className="px-3 py-2">Days</th>
                                <th className="px-3 py-2">Hours/Day</th>
                              </>
                            ) : (
                              <th className="px-3 py-2">Total Hours</th>
                            )}
                            <th className="px-3 py-2">Work Type</th>
                            <th className="px-3 py-2">Regular Hours</th>
                            <th className="px-3 py-2">Overtime Hours</th>
                            <th className="px-3 py-2">Total Cost</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {(scope.labour_items ?? []).map((item, itemIndex) => {
                            const calculatedItem =
                              calculatedScope?.labour_items[itemIndex];

                            return (
                              <tr key={item.id ?? itemIndex}>
                                <td className="px-3 py-2">
                                  <input
                                    className={inputClass}
                                    value={item.labour_description ?? ""}
                                    onChange={(event) =>
                                      updateLabour(scopeIndex, itemIndex, {
                                        labour_description: event.target.value,
                                      })
                                    }
                                  />
                                </td>
                                {scope.labour_calculation_method === "crew" ? (
                                  <>
                                    <td className="px-3 py-2">
                                      <NumberCell
                                        value={item.number_of_workers}
                                        onChange={(value) =>
                                          updateLabour(scopeIndex, itemIndex, {
                                            number_of_workers: value,
                                          })
                                        }
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <NumberCell
                                        value={item.number_of_days}
                                        onChange={(value) =>
                                          updateLabour(scopeIndex, itemIndex, {
                                            number_of_days: value,
                                          })
                                        }
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <NumberCell
                                        value={item.hours_per_day}
                                        onChange={(value) =>
                                          updateLabour(scopeIndex, itemIndex, {
                                            hours_per_day: value,
                                          })
                                        }
                                      />
                                    </td>
                                  </>
                                ) : (
                                  <td className="px-3 py-2">
                                    <NumberCell
                                      value={item.total_hours}
                                      onChange={(value) =>
                                        updateLabour(scopeIndex, itemIndex, {
                                          total_hours: value,
                                        })
                                      }
                                    />
                                  </td>
                                )}
                                <td className="px-3 py-2">
                                  <select
                                    className={inputClass}
                                    value={item.work_type ?? "regular"}
                                    onChange={(event) =>
                                      updateLabour(scopeIndex, itemIndex, {
                                        work_type: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="regular">Regular</option>
                                    <option value="overtime">Overtime</option>
                                    <option value="weekend">Weekend</option>
                                    <option value="confined_space">
                                      Confined Space
                                    </option>
                                  </select>
                                </td>
                                <td className="px-3 py-2">
                                  {calculatedItem?.regular_hours ?? 0}
                                </td>
                                <td className="px-3 py-2">
                                  {calculatedItem?.overtime_hours ?? 0}
                                </td>
                                <td className="px-3 py-2 font-semibold">
                                  {formatCurrency(calculatedItem?.total_cost)}
                                </td>
                                <td className="px-3 py-2">
                                  <button
                                    className="text-sm font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                                    type="button"
                                    onClick={() =>
                                      updateScope(scopeIndex, {
                                        labour_items: (
                                          scope.labour_items ?? []
                                        ).filter(
                                          (_, index) => index !== itemIndex,
                                        ),
                                      })
                                    }
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </BuilderSection>

                  <BuilderSection
                    title="Additional Charges"
                    onAdd={() =>
                      updateScope(scopeIndex, {
                        scope_charges: [
                          ...(scope.scope_charges ?? []),
                          newScopeCharge(),
                        ],
                      })
                    }
                  >
                    <div className="grid gap-3">
                      {(scope.scope_charges ?? []).map((charge, chargeIndex) => (
                        <div
                          className="grid gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 md:grid-cols-[1fr_180px_auto]"
                          key={charge.id ?? chargeIndex}
                        >
                          <input
                            className={inputClass}
                            placeholder="Description"
                            value={charge.description ?? ""}
                            onChange={(event) =>
                              updateCharge(scopeIndex, chargeIndex, {
                                description: event.target.value,
                              })
                            }
                          />
                          <input
                            className={inputClass}
                            min="0"
                            step="0.01"
                            type="number"
                            value={String(charge.amount ?? "")}
                            onChange={(event) =>
                              updateCharge(scopeIndex, chargeIndex, {
                                amount: event.target.value,
                              })
                            }
                          />
                          <button
                            className="text-sm font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                            type="button"
                            onClick={() =>
                              updateScope(scopeIndex, {
                                scope_charges: (
                                  scope.scope_charges ?? []
                                ).filter((_, index) => index !== chargeIndex),
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </BuilderSection>

                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                    <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Scope Summary
                    </h4>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <SummaryLine
                        label="Material Total"
                        value={formatCurrency(calculatedScope?.material_total)}
                      />
                      <SummaryLine
                        label="Material Profit Total"
                        value={formatCurrency(
                          calculatedScope?.material_profit_total,
                        )}
                      />
                      <SummaryLine
                        label="Labour Total"
                        value={formatCurrency(calculatedScope?.labour_total)}
                      />
                      <SummaryLine
                        label="Additional Charges Total"
                        value={formatCurrency(
                          calculatedScope?.additional_charges_total,
                        )}
                      />
                      <SummaryLine
                        label="Subtotal Before Discount"
                        value={formatCurrency(
                          calculatedScope?.scope_subtotal_before_discount,
                        )}
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Discount Type">
                          <select
                            className={inputClass}
                            value={scope.discount_type ?? "none"}
                            onChange={(event) =>
                              updateScope(scopeIndex, {
                                discount_type: event.target.value,
                              })
                            }
                          >
                            <option value="none">None</option>
                            <option value="percentage">Percentage</option>
                            <option value="amount">Amount</option>
                          </select>
                        </Field>
                        <Field label="Discount Value">
                          <input
                            className={inputClass}
                            min="0"
                            step="0.01"
                            type="number"
                            value={String(scope.discount_value ?? "")}
                            onChange={(event) =>
                              updateScope(scopeIndex, {
                                discount_value: event.target.value,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <SummaryLine
                        label="Discount Amount"
                        value={formatCurrency(calculatedScope?.discount_amount)}
                      />
                      <SummaryLine
                        label="Scope Total After Discount"
                        strong
                        value={formatCurrency(
                          calculatedScope?.scope_total_after_discount,
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Draft Totals
          </h2>
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
              label="Scope Discounts"
              value={formatCurrency(calculated.totals.scopes_discount_total)}
            />
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <SummaryLine
                label="Overall Draft Subtotal"
                strong
                value={formatCurrency(calculated.totals.grand_total_before_tax)}
              />
            </div>
          </div>
        </div>
      </aside>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function BuilderSection({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h4>
        <button
          className="shrink-0 whitespace-nowrap rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
          type="button"
          onClick={onAdd}
        >
          Add Row
        </button>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function NumberCell({
  value,
  onChange,
}: {
  value: number | string | null | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <input
      className={inputClass}
      min="0"
      step="0.01"
      type="number"
      value={String(value ?? "")}
      onChange={(event) => onChange(event.target.value)}
    />
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
      <span className="text-zinc-500 dark:text-zinc-400">
        {formatLabel(label)}
      </span>
      <span
        className={
          strong
            ? "font-semibold text-zinc-950 dark:text-zinc-50"
            : "font-medium text-zinc-700 dark:text-zinc-200"
        }
      >
        {value}
      </span>
    </div>
  );
}
