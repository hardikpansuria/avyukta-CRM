export type DiscountType = "none" | "percentage" | "amount";
export type LabourCalculationMethod = "hourly" | "crew";
export type ProfitType = "percentage" | "amount";
export type WorkType = "regular" | "overtime" | "weekend" | "confined_space";

export type QuotationDocument = {
  id: string;
  file_name: string;
  file_size?: number | string | null;
  mime_type: string;
  signed_url?: string | null;
};

export type MaterialItemInput = {
  id?: string;
  is_persisted?: boolean;
  material_description?: string | null;
  material_category?: string | null;
  supplier_name?: string | null;
  supplier_quote_reference?: string | null;
  quantity?: number | string | null;
  unit_cost?: number | string | null;
  profit_type?: string | null;
  profit_value?: number | string | null;
  supplier_quote_document?: QuotationDocument | null;
};

export type LabourItemInput = {
  id?: string;
  labour_description?: string | null;
  total_hours?: number | string | null;
  number_of_workers?: number | string | null;
  number_of_days?: number | string | null;
  hours_per_day?: number | string | null;
  work_type?: string | null;
};

export type ScopeChargeInput = {
  id?: string;
  is_persisted?: boolean;
  description?: string | null;
  amount?: number | string | null;
  profit_type?: string | null;
  profit_value?: number | string | null;
  supporting_document?: QuotationDocument | null;
};

export type ScopeInput = {
  id?: string;
  scope_title?: string | null;
  scope_description?: string | null;
  labour_calculation_method?: string | null;
  regular_hourly_rate?: number | string | null;
  overtime_hourly_rate?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  material_items?: MaterialItemInput[];
  labour_items?: LabourItemInput[];
  scope_charges?: ScopeChargeInput[];
};

export type FinalAdjustmentInput = {
  id?: string;
  adjustment_type?: string | null;
  description?: string | null;
  calculation_type?: string | null;
  value?: number | string | null;
};

export type CalculatedMaterialItem = MaterialItemInput & {
  quantity: number;
  unit_cost: number;
  profit_type: ProfitType;
  profit_value: number;
  material_cost: number;
  profit_amount: number;
  line_total: number;
};

export type CalculatedLabourItem = LabourItemInput & {
  work_type: WorkType;
  regular_hours: number;
  overtime_hours: number;
  regular_rate: number;
  overtime_rate: number;
  regular_cost: number;
  overtime_cost: number;
  total_cost: number;
};

export type CalculatedScopeCharge = ScopeChargeInput & {
  amount: number;
  profit_type: ProfitType;
  profit_value: number;
  profit_amount: number;
  line_total: number;
};

export type CalculatedScope = Omit<
  ScopeInput,
  | "material_items"
  | "labour_items"
  | "scope_charges"
  | "scope_title"
  | "labour_calculation_method"
  | "regular_hourly_rate"
  | "overtime_hourly_rate"
  | "discount_type"
  | "discount_value"
> & {
  scope_title: string;
  labour_calculation_method: LabourCalculationMethod;
  regular_hourly_rate: number;
  overtime_hourly_rate: number;
  discount_type: DiscountType;
  discount_value: number;
  material_items: CalculatedMaterialItem[];
  labour_items: CalculatedLabourItem[];
  scope_charges: CalculatedScopeCharge[];
  material_total: number;
  material_profit_total: number;
  labour_total: number;
  additional_charges_total: number;
  scope_subtotal_before_discount: number;
  discount_amount: number;
  scope_total_after_discount: number;
};

export type QuotationTotals = {
  material_total: number;
  material_profit_total: number;
  labour_total: number;
  scope_additional_charges_total: number;
  scopes_subtotal: number;
  scopes_discount_total: number;
  grand_total_before_tax: number;
};

export type FinalTotals = QuotationTotals & {
  final_discount_type: DiscountType;
  final_discount_value: number;
  final_discount_amount: number;
  final_additional_charges_total: number;
  taxable_subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total_after_tax: number;
  final_adjustments: Array<FinalAdjustmentInput & { calculated_amount: number }>;
};

export const emptyQuotationTotals: QuotationTotals = {
  material_total: 0,
  material_profit_total: 0,
  labour_total: 0,
  scope_additional_charges_total: 0,
  scopes_subtotal: 0,
  scopes_discount_total: 0,
  grand_total_before_tax: 0,
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toPositiveNumber(value: number | string | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
}

function normalizeDiscountType(value: string | null | undefined): DiscountType {
  return value === "percentage" || value === "amount" ? value : "none";
}

function normalizeProfitType(value: string | null | undefined): ProfitType {
  return value === "amount" ? "amount" : "percentage";
}

function normalizeWorkType(value: string | null | undefined): WorkType {
  return value === "overtime" ||
    value === "weekend" ||
    value === "confined_space"
    ? value
    : "regular";
}

export function normalizeLabourMethod(
  value: string | null | undefined,
): LabourCalculationMethod {
  return value === "crew" ? "crew" : "hourly";
}

function calculateDiscount(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
) {
  if (discountType === "percentage") {
    return roundMoney(subtotal * (discountValue / 100));
  }

  if (discountType === "amount") {
    return roundMoney(Math.min(discountValue, subtotal));
  }

  return 0;
}

function calculateAmount(
  base: number,
  calculationType: string | null | undefined,
  value: number,
) {
  return calculationType === "percentage"
    ? roundMoney(base * (value / 100))
    : roundMoney(value);
}

export function calculateMaterialItem(
  item: MaterialItemInput,
): CalculatedMaterialItem {
  const quantity = toPositiveNumber(item.quantity);
  const unitCost = toPositiveNumber(item.unit_cost);
  const profitType = normalizeProfitType(item.profit_type);
  const profitValue = toPositiveNumber(item.profit_value);
  const materialCost = roundMoney(quantity * unitCost);
  const profitAmount =
    profitType === "percentage"
      ? roundMoney(materialCost * (profitValue / 100))
      : roundMoney(profitValue);

  return {
    ...item,
    quantity,
    unit_cost: unitCost,
    profit_type: profitType,
    profit_value: profitValue,
    material_cost: materialCost,
    profit_amount: profitAmount,
    line_total: roundMoney(materialCost + profitAmount),
  };
}

export function calculateLabourItem(
  item: LabourItemInput,
  method: LabourCalculationMethod,
  regularRate: number,
  overtimeRate: number,
): CalculatedLabourItem {
  const workType = normalizeWorkType(item.work_type);
  let regularHours = 0;
  let overtimeHours = 0;

  if (method === "crew") {
    const workers = toPositiveNumber(item.number_of_workers);
    const days = toPositiveNumber(item.number_of_days);
    const hoursPerDay = toPositiveNumber(item.hours_per_day);

    if (workType === "regular") {
      regularHours = workers * days * Math.min(8, hoursPerDay);
      overtimeHours = workers * days * Math.max(0, hoursPerDay - 8);
    } else {
      overtimeHours = workers * days * hoursPerDay;
    }
  } else {
    const totalHours = toPositiveNumber(item.total_hours);

    if (workType === "regular") {
      regularHours = totalHours;
    } else {
      overtimeHours = totalHours;
    }
  }

  const regularCost = roundMoney(regularHours * regularRate);
  const overtimeCost = roundMoney(overtimeHours * overtimeRate);

  return {
    ...item,
    work_type: workType,
    regular_hours: roundMoney(regularHours),
    overtime_hours: roundMoney(overtimeHours),
    regular_rate: regularRate,
    overtime_rate: overtimeRate,
    regular_cost: regularCost,
    overtime_cost: overtimeCost,
    total_cost: roundMoney(regularCost + overtimeCost),
  };
}

export function calculateScope(scope: ScopeInput): CalculatedScope {
  const method = normalizeLabourMethod(scope.labour_calculation_method);
  const regularRate = toPositiveNumber(scope.regular_hourly_rate);
  const overtimeRate = toPositiveNumber(scope.overtime_hourly_rate);
  const materialItems = (scope.material_items ?? []).map(calculateMaterialItem);
  const labourItems = (scope.labour_items ?? []).map((item) =>
    calculateLabourItem(item, method, regularRate, overtimeRate),
  );
  const scopeCharges = (scope.scope_charges ?? []).map((charge) => {
    const amount = roundMoney(toPositiveNumber(charge.amount));
    const profitType = normalizeProfitType(charge.profit_type);
    const profitValue = toPositiveNumber(charge.profit_value);
    const profitAmount =
      profitType === "percentage"
        ? roundMoney(amount * (profitValue / 100))
        : roundMoney(profitValue);

    return {
      ...charge,
      amount,
      profit_type: profitType,
      profit_value: profitValue,
      profit_amount: profitAmount,
      line_total: roundMoney(amount + profitAmount),
    };
  });
  const materialTotal = roundMoney(
    materialItems.reduce((sum, item) => sum + item.material_cost, 0),
  );
  const materialProfitTotal = roundMoney(
    materialItems.reduce((sum, item) => sum + item.profit_amount, 0),
  );
  const labourTotal = roundMoney(
    labourItems.reduce((sum, item) => sum + item.total_cost, 0),
  );
  const additionalChargesTotal = roundMoney(
    scopeCharges.reduce((sum, charge) => sum + charge.line_total, 0),
  );
  const subtotalBeforeDiscount = roundMoney(
    materialTotal +
      materialProfitTotal +
      labourTotal +
      additionalChargesTotal,
  );
  const discountType = normalizeDiscountType(scope.discount_type);
  const discountValue = toPositiveNumber(scope.discount_value);
  const discountAmount = calculateDiscount(
    subtotalBeforeDiscount,
    discountType,
    discountValue,
  );

  return {
    ...scope,
    scope_title: scope.scope_title?.trim() || "Scope of Work",
    labour_calculation_method: method,
    regular_hourly_rate: regularRate,
    overtime_hourly_rate: overtimeRate,
    discount_type: discountType,
    discount_value: discountValue,
    material_items: materialItems,
    labour_items: labourItems,
    scope_charges: scopeCharges,
    material_total: materialTotal,
    material_profit_total: materialProfitTotal,
    labour_total: labourTotal,
    additional_charges_total: additionalChargesTotal,
    scope_subtotal_before_discount: subtotalBeforeDiscount,
    discount_amount: discountAmount,
    scope_total_after_discount: roundMoney(
      subtotalBeforeDiscount - discountAmount,
    ),
  };
}

export function calculateQuotationTotals(
  scopes: ScopeInput[],
): { scopes: CalculatedScope[]; totals: QuotationTotals } {
  const calculatedScopes = scopes.map(calculateScope);
  const totals = calculatedScopes.reduce<QuotationTotals>(
    (currentTotals, scope) => ({
      material_total: roundMoney(
        currentTotals.material_total + scope.material_total,
      ),
      material_profit_total: roundMoney(
        currentTotals.material_profit_total + scope.material_profit_total,
      ),
      labour_total: roundMoney(currentTotals.labour_total + scope.labour_total),
      scope_additional_charges_total: roundMoney(
        currentTotals.scope_additional_charges_total +
          scope.additional_charges_total,
      ),
      scopes_subtotal: roundMoney(
        currentTotals.scopes_subtotal +
          scope.scope_subtotal_before_discount,
      ),
      scopes_discount_total: roundMoney(
        currentTotals.scopes_discount_total + scope.discount_amount,
      ),
      grand_total_before_tax: roundMoney(
        currentTotals.grand_total_before_tax +
          scope.scope_total_after_discount,
      ),
    }),
    { ...emptyQuotationTotals },
  );

  return { scopes: calculatedScopes, totals };
}

export function calculateFinalTotals({
  scopeTotals,
  finalDiscountType,
  finalDiscountValue,
  finalAdjustments,
  taxRate,
}: {
  scopeTotals: QuotationTotals;
  finalDiscountType?: string | null;
  finalDiscountValue?: number | string | null;
  finalAdjustments?: FinalAdjustmentInput[];
  taxRate?: number | string | null;
}): FinalTotals {
  const normalizedDiscountType = normalizeDiscountType(finalDiscountType);
  const normalizedDiscountValue = toPositiveNumber(finalDiscountValue);
  const finalDiscountAmount = calculateDiscount(
    scopeTotals.grand_total_before_tax,
    normalizedDiscountType,
    normalizedDiscountValue,
  );
  const calculatedAdjustments = (finalAdjustments ?? []).map((adjustment) => {
    const value = toPositiveNumber(adjustment.value);
    const calculationType =
      adjustment.calculation_type === "percentage" ? "percentage" : "amount";

    return {
      ...adjustment,
      adjustment_type: "additional_charge",
      calculation_type: calculationType,
      value,
      calculated_amount: calculateAmount(
        scopeTotals.grand_total_before_tax,
        calculationType,
        value,
      ),
    };
  });
  const finalAdditionalChargesTotal = roundMoney(
    calculatedAdjustments.reduce(
      (sum, adjustment) => sum + adjustment.calculated_amount,
      0,
    ),
  );
  const taxableSubtotal = roundMoney(
    Math.max(
      0,
      scopeTotals.grand_total_before_tax -
        finalDiscountAmount +
        finalAdditionalChargesTotal,
    ),
  );
  const normalizedTaxRate = toPositiveNumber(taxRate);
  const taxAmount = roundMoney(taxableSubtotal * (normalizedTaxRate / 100));

  return {
    ...scopeTotals,
    final_discount_type: normalizedDiscountType,
    final_discount_value: normalizedDiscountValue,
    final_discount_amount: finalDiscountAmount,
    final_additional_charges_total: finalAdditionalChargesTotal,
    taxable_subtotal: taxableSubtotal,
    tax_rate: normalizedTaxRate,
    tax_amount: taxAmount,
    grand_total_before_tax: taxableSubtotal,
    grand_total_after_tax: roundMoney(taxableSubtotal + taxAmount),
    final_adjustments: calculatedAdjustments,
  };
}
