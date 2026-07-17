"use client";

import {
  calculateFinalTotals,
  calculateQuotationTotals,
  type FinalAdjustmentInput,
  type ScopeInput,
} from "@/lib/quotations/scope-calculations";

export type NoteSectionInput = {
  section_type: string;
  title: string;
  body_text: string;
};

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const textareaClass =
  "min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-300";
const cardClass =
  "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

export const defaultNoteSections: NoteSectionInput[] = [
  ["scope_of_work", "Scope of Work"],
  ["exclusions", "Exclusions"],
  ["assumptions", "Assumptions"],
  ["warranty", "Warranty"],
  ["delivery_time", "Delivery Time"],
  ["payment_terms", "Payment Terms"],
  ["quotation_validity", "Quotation Validity"],
  ["customer_notes", "Customer Notes"],
  ["internal_notes", "Internal Notes"],
].map(([section_type, title]) => ({
  section_type,
  title,
  body_text: "",
}));

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

function newAdjustment(): FinalAdjustmentInput {
  return {
    id: crypto.randomUUID(),
    adjustment_type: "additional_charge",
    description: "",
    calculation_type: "amount",
    value: "",
  };
}

export function FinalSections({
  scopes,
  finalDiscountType,
  finalDiscountValue,
  finalAdjustments,
  noteSections,
  taxRate,
  taxWarning,
  onFinalDiscountTypeChange,
  onFinalDiscountValueChange,
  onFinalAdjustmentsChange,
  onNoteSectionsChange,
}: {
  scopes: ScopeInput[];
  finalDiscountType: string;
  finalDiscountValue: string;
  finalAdjustments: FinalAdjustmentInput[];
  noteSections: NoteSectionInput[];
  taxRate?: number | string | null;
  taxWarning?: string | null;
  onFinalDiscountTypeChange: (value: string) => void;
  onFinalDiscountValueChange: (value: string) => void;
  onFinalAdjustmentsChange: (value: FinalAdjustmentInput[]) => void;
  onNoteSectionsChange: (value: NoteSectionInput[]) => void;
}) {
  const scopeTotals = calculateQuotationTotals(scopes).totals;
  const finalTotals = calculateFinalTotals({
    scopeTotals,
    finalDiscountType,
    finalDiscountValue,
    finalAdjustments,
    taxRate,
  });

  function updateAdjustment(
    index: number,
    updates: Partial<FinalAdjustmentInput>,
  ) {
    onFinalAdjustmentsChange(
      finalAdjustments.map((adjustment, adjustmentIndex) =>
        adjustmentIndex === index
          ? { ...adjustment, ...updates }
          : adjustment,
      ),
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Final Adjustments
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Final Discount Type
              </span>
              <select
                className={`${inputClass} mt-2`}
                value={finalDiscountType}
                onChange={(event) =>
                  onFinalDiscountTypeChange(event.target.value)
                }
              >
                <option value="none">None</option>
                <option value="percentage">Percentage</option>
                <option value="amount">Amount</option>
              </select>
            </label>
            <label>
              <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                Final Discount Value
              </span>
              <input
                className={`${inputClass} mt-2`}
                min="0"
                step="0.01"
                type="number"
                value={finalDiscountValue}
                onChange={(event) =>
                  onFinalDiscountValueChange(event.target.value)
                }
              />
            </label>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Final Additional Charges
            </h3>
            <button
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              type="button"
              onClick={() =>
                onFinalAdjustmentsChange([...finalAdjustments, newAdjustment()])
              }
            >
              Add Charge
            </button>
          </div>
          <div className="mt-3 space-y-3">
            {finalAdjustments.map((adjustment, index) => (
              <div
                className="grid gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800 md:grid-cols-[1fr_160px_160px_auto]"
                key={adjustment.id ?? index}
              >
                <input
                  className={inputClass}
                  placeholder="Description"
                  value={adjustment.description ?? ""}
                  onChange={(event) =>
                    updateAdjustment(index, {
                      description: event.target.value,
                    })
                  }
                />
                <select
                  className={inputClass}
                  value={adjustment.calculation_type ?? "amount"}
                  onChange={(event) =>
                    updateAdjustment(index, {
                      calculation_type: event.target.value,
                    })
                  }
                >
                  <option value="amount">Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
                <input
                  className={inputClass}
                  min="0"
                  step="0.01"
                  type="number"
                  value={String(adjustment.value ?? "")}
                  onChange={(event) =>
                    updateAdjustment(index, { value: event.target.value })
                  }
                />
                <button
                  className="text-sm font-medium text-zinc-500 hover:text-red-600 dark:text-zinc-400"
                  type="button"
                  onClick={() =>
                    onFinalAdjustmentsChange(
                      finalAdjustments.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Notes and Terms
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {noteSections.map((section, index) => (
              <label className="block" key={section.section_type}>
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {section.title}
                </span>
                <textarea
                  className={`${textareaClass} mt-2`}
                  value={section.body_text}
                  onChange={(event) =>
                    onNoteSectionsChange(
                      noteSections.map((note, noteIndex) =>
                        noteIndex === index
                          ? { ...note, body_text: event.target.value }
                          : note,
                      ),
                    )
                  }
                />
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Final Summary
          </h2>
          {taxWarning ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {taxWarning}
            </p>
          ) : null}
          <div className="mt-5 space-y-3">
            <SummaryLine
              label="Scopes After Discounts"
              value={formatCurrency(scopeTotals.grand_total_before_tax)}
            />
            <SummaryLine
              label="Final Discount"
              value={`-${formatCurrency(finalTotals.final_discount_amount)}`}
            />
            <SummaryLine
              label="Final Additional Charges"
              value={formatCurrency(finalTotals.final_additional_charges_total)}
            />
            <SummaryLine
              label="Before Tax"
              value={formatCurrency(finalTotals.grand_total_before_tax)}
            />
            <SummaryLine
              label="Tax"
              value={formatCurrency(finalTotals.tax_amount)}
            />
            <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <SummaryLine
                label="After Tax"
                strong
                value={formatCurrency(finalTotals.grand_total_after_tax)}
              />
            </div>
          </div>
        </div>
      </aside>
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
