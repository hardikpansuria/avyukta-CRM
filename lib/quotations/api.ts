import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateFinalTotals,
  calculateQuotationTotals,
  toPositiveNumber,
  type FinalAdjustmentInput,
  type LabourItemInput,
  type MaterialItemInput,
  type ScopeChargeInput,
  type ScopeInput,
} from "@/lib/quotations/scope-calculations";

export type QuotationBody = {
  customer_id?: unknown;
  quote_date?: unknown;
  expiry_date?: unknown;
  project_name?: unknown;
  project_location?: unknown;
  customer_rfq_number?: unknown;
  sales_rep_id?: unknown;
  status?: unknown;
  contact_ids?: unknown;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type CustomerRow = {
  id: string;
  company_name: string;
  customer_code?: string | null;
  legal_company_name?: string | null;
};

type CustomerContactRow = {
  id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile_number?: string | null;
};

type QuotationRow = {
  id: string;
  quotation_number?: string | null;
  customer_id: string;
  quote_date?: string | null;
  expiry_date?: string | null;
  project_name?: string | null;
  project_location?: string | null;
  customer_rfq_number?: string | null;
  revision_number?: number | string | null;
  prepared_by?: string | null;
  sales_rep_id?: string | null;
  status?: string | null;
  material_total?: number | string | null;
  material_profit_total?: number | string | null;
  labour_total?: number | string | null;
  scope_additional_charges_total?: number | string | null;
  scopes_subtotal?: number | string | null;
  scopes_discount_total?: number | string | null;
  final_discount_type?: string | null;
  final_discount_value?: number | string | null;
  final_discount_amount?: number | string | null;
  final_additional_charges_total?: number | string | null;
  grand_total_before_tax?: number | string | null;
  is_tax_exempt?: boolean | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
  tax_amount?: number | string | null;
  grand_total_after_tax?: number | string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type QuotationContactRow = {
  id?: string;
  quotation_id?: string;
  customer_contact_id?: string | null;
  contact_name_snapshot?: string | null;
  email_snapshot?: string | null;
  phone_snapshot?: string | null;
};

type ScopeRow = ScopeInput & {
  id: string;
  quotation_id: string;
  sort_order?: number | null;
  quantity?: number | string | null;
  material_total?: number | string | null;
  material_profit_total?: number | string | null;
  labour_total?: number | string | null;
  additional_charges_total?: number | string | null;
  scope_subtotal_before_discount?: number | string | null;
  discount_amount?: number | string | null;
  scope_total_after_discount?: number | string | null;
};

type MaterialRow = MaterialItemInput & {
  id: string;
  quotation_id?: string;
  scope_id: string;
  material_cost?: number | string | null;
  profit_amount?: number | string | null;
  line_total?: number | string | null;
  sort_order?: number | null;
};

type LabourRow = LabourItemInput & {
  id: string;
  scope_id: string;
  calculation_method?: string | null;
  regular_hours?: number | string | null;
  overtime_hours?: number | string | null;
  regular_rate?: number | string | null;
  overtime_rate?: number | string | null;
  regular_cost?: number | string | null;
  overtime_cost?: number | string | null;
  total_cost?: number | string | null;
  sort_order?: number | null;
};

type ChargeRow = ScopeChargeInput & {
  id: string;
  scope_id: string;
  sort_order?: number | null;
};

type MaterialDocumentRow = {
  id: string;
  material_item_id: string;
  storage_bucket: string;
  file_name: string;
  file_path: string;
  file_size?: number | string | null;
  mime_type: string;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  signed_url?: string | null;
};

type ChargeDocumentRow = {
  id: string;
  scope_charge_id: string;
  storage_bucket: string;
  file_name: string;
  file_path: string;
  file_size?: number | string | null;
  mime_type: string;
  uploaded_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  signed_url?: string | null;
};

type MaterialWithDocument = MaterialRow & {
  supplier_quote_document?: MaterialDocumentRow | null;
};

type ChargeWithDocument = ChargeRow & {
  supporting_document?: ChargeDocumentRow | null;
};

type FinalAdjustmentRow = FinalAdjustmentInput & {
  id: string;
  calculated_amount?: number | string | null;
  sort_order?: number | null;
};

type NoteSectionInput = {
  section_type?: string | null;
  title?: string | null;
  body_text?: string | null;
};

type NoteSectionRow = NoteSectionInput & {
  id: string;
  body_html?: string | null;
  visible_to_customer?: boolean | null;
};

type CustomerTaxInfo = {
  taxExempt: boolean;
  taxName: string | null;
  taxRate: number;
  provinceCode: string | null;
  warning: string | null;
};

export const quotationStatuses = new Set([
  "draft",
  "pending_approval",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted_to_work_order",
]);

export const allowedQuotationRoles = new Set(["admin", "sales", "accountant"]);

export function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function getOptionalString(value: unknown) {
  const text = getString(value);
  return text ? text : null;
}

export function getOptionalDate(value: unknown, fieldName: string) {
  const text = getString(value);

  if (!text) {
    return { value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { error: `${fieldName} must be a valid date` };
  }

  return { value: text };
}

export function getOptionalStatus(value: unknown) {
  const text = getString(value);

  if (!text) {
    return { value: null };
  }

  if (!quotationStatuses.has(text)) {
    return { error: "Status is invalid" };
  }

  return { value: text };
}

export function normalizeContactIds(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(value)) {
    return { error: "Selected contacts are invalid" };
  }

  const ids = Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  );

  if (ids.length > 2) {
    return { error: "Select up to 2 customer contacts" };
  }

  return { value: ids };
}

export async function validateCustomer(
  admin: SupabaseClient,
  orgId: string,
  customerId: string,
) {
  const { data, error } = await admin
    .from("customers")
    .select("id, company_name, customer_code, legal_company_name")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .neq("record_status", "deleted")
    .maybeSingle();

  return { customer: data as CustomerRow | null, error };
}

export async function validateSalesRep(
  admin: SupabaseClient,
  orgId: string,
  salesRepId: string | null,
) {
  if (!salesRepId) {
    return { isValid: true };
  }

  const { data, error } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("status", "active")
    .eq("user_id", salesRepId)
    .maybeSingle();

  if (error) {
    return { error };
  }

  return { isValid: Boolean(data) };
}

export async function validateCustomerContacts(
  admin: SupabaseClient,
  orgId: string,
  customerId: string,
  contactIds: string[] | undefined,
) {
  if (!contactIds || contactIds.length === 0) {
    return { contacts: [] as CustomerContactRow[] };
  }

  const { data, error } = await admin
    .from("customer_contacts")
    .select("id, first_name, last_name, email, office_phone, mobile_number")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "deleted")
    .in("id", contactIds);

  if (error) {
    return { error };
  }

  const contacts = (data ?? []) as CustomerContactRow[];

  if (contacts.length !== contactIds.length) {
    return { invalid: true };
  }

  return { contacts };
}

export function buildQuotationContactRows(
  orgId: string,
  quotationId: string,
  contacts: CustomerContactRow[],
) {
  return contacts.map((contact, index) => ({
    org_id: orgId,
    quotation_id: quotationId,
    customer_contact_id: contact.id,
    contact_role: "quotation_contact",
    sort_order: index + 1,
    contact_name_snapshot: [contact.first_name, contact.last_name]
      .filter(Boolean)
      .join(" "),
    email_snapshot: contact.email ?? null,
    phone_snapshot: contact.office_phone ?? contact.mobile_number ?? null,
  }));
}

function getArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function hasMaterialValue(item: Record<string, unknown>) {
  return [
    item.material_description,
    item.material_category,
    item.supplier_name,
    item.supplier_quote_reference,
    item.quantity,
    item.unit_cost,
    item.profit_value,
  ].some((value) => String(value ?? "").trim().length > 0);
}

function hasLabourValue(item: Record<string, unknown>) {
  return [
    item.labour_description,
    item.total_hours,
    item.number_of_workers,
    item.number_of_days,
    item.hours_per_day,
  ].some((value) => String(value ?? "").trim().length > 0);
}

function hasChargeValue(item: Record<string, unknown>) {
  return [item.description, item.amount, item.profit_value].some(
    (value) => String(value ?? "").trim().length > 0,
  );
}

function isValidDecimalInput(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0;
  }

  return /^\d+(?:\.\d*)?$/.test(String(value).trim());
}

function hasAdjustmentValue(item: Record<string, unknown>) {
  return [item.description, item.value].some(
    (value) => String(value ?? "").trim().length > 0,
  );
}

export function normalizeFinalAdjustmentsPayload(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(value)) {
    return { error: "Final adjustments are invalid" };
  }

  const adjustments: FinalAdjustmentInput[] = [];

  for (const rawAdjustment of value) {
    if (!rawAdjustment || typeof rawAdjustment !== "object") {
      return { error: "Each final adjustment must be an object" };
    }

    const adjustment = rawAdjustment as Record<string, unknown>;

    if (!hasAdjustmentValue(adjustment)) {
      continue;
    }

    if (!trimText(adjustment.description)) {
      return { error: "Each final adjustment must include a description" };
    }

    adjustments.push({
      id: trimText(adjustment.id) || undefined,
      adjustment_type: "additional_charge",
      description: trimText(adjustment.description),
      calculation_type:
        trimText(adjustment.calculation_type) === "percentage"
          ? "percentage"
          : "amount",
      value: adjustment.value as string | number | null,
    });
  }

  return { value: adjustments };
}

const noteSectionTitles = new Map([
  ["scope_of_work", "Scope of Work"],
  ["exclusions", "Exclusions"],
  ["assumptions", "Assumptions"],
  ["warranty", "Warranty"],
  ["delivery_time", "Delivery Time"],
  ["payment_terms", "Payment Terms"],
  ["quotation_validity", "Quotation Validity"],
  ["customer_notes", "Customer Notes"],
  ["internal_notes", "Internal Notes"],
]);

export function normalizeNoteSectionsPayload(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(value)) {
    return { error: "Note sections are invalid" };
  }

  const sections: NoteSectionInput[] = [];

  for (const rawSection of value) {
    if (!rawSection || typeof rawSection !== "object") {
      return { error: "Each note section must be an object" };
    }

    const section = rawSection as Record<string, unknown>;
    const sectionType = trimText(section.section_type);

    if (!noteSectionTitles.has(sectionType)) {
      return { error: "Note section type is invalid" };
    }

    sections.push({
      section_type: sectionType,
      title:
        trimText(section.title) ||
        noteSectionTitles.get(sectionType) ||
        "Notes",
      body_text: trimText(section.body_text),
    });
  }

  return { value: sections };
}

function normalizeProvinceCode(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();
  const provinceMap = new Map([
    ["ALBERTA", "AB"],
    ["BRITISH COLUMBIA", "BC"],
    ["MANITOBA", "MB"],
    ["NEW BRUNSWICK", "NB"],
    ["NEWFOUNDLAND AND LABRADOR", "NL"],
    ["NOVA SCOTIA", "NS"],
    ["ONTARIO", "ON"],
    ["PRINCE EDWARD ISLAND", "PE"],
    ["QUEBEC", "QC"],
    ["SASKATCHEWAN", "SK"],
    ["NORTHWEST TERRITORIES", "NT"],
    ["NUNAVUT", "NU"],
    ["YUKON", "YT"],
  ]);

  if (normalized.length === 2) {
    return normalized;
  }

  return provinceMap.get(normalized) ?? null;
}

async function getCustomerTaxInfo(
  admin: SupabaseClient,
  orgId: string,
  customerId: string,
): Promise<CustomerTaxInfo> {
  const { data: customer } = await admin
    .from("customers")
    .select("tax_exempt")
    .eq("id", customerId)
    .eq("org_id", orgId)
    .maybeSingle();
  const { data: addresses } = await admin
    .from("customer_addresses")
    .select("address_type, province_state")
    .eq("org_id", orgId)
    .eq("customer_id", customerId)
    .neq("status", "deleted");
  const addressRows = (addresses ?? []) as Array<{
    address_type: string;
    province_state?: string | null;
  }>;
  const billing = addressRows.find(
    (address) => address.address_type === "billing",
  );
  const headOffice = addressRows.find(
    (address) => address.address_type === "head_office",
  );
  const provinceCode = normalizeProvinceCode(
    billing?.province_state ?? headOffice?.province_state ?? null,
  );

  if (customer?.tax_exempt === true) {
    return {
      taxExempt: true,
      taxName: null,
      taxRate: 0,
      provinceCode,
      warning: null,
    };
  }

  if (!provinceCode) {
    return {
      taxExempt: false,
      taxName: null,
      taxRate: 0,
      provinceCode: null,
      warning: "Tax could not be auto-determined. Please verify customer address.",
    };
  }

  const { data: taxRate } = await admin
    .from("tax_rates")
    .select("tax_name, combined_rate")
    .eq("province_code", provinceCode)
    .eq("status", "active")
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    taxExempt: false,
    taxName: (taxRate?.tax_name as string | null | undefined) ?? null,
    taxRate: toPositiveNumber(taxRate?.combined_rate as number | string | null),
    provinceCode,
    warning: taxRate ? null : "Tax could not be auto-determined. Please verify customer address.",
  };
}

export function normalizeScopesPayload(value: unknown) {
  if (value === undefined) {
    return { value: undefined };
  }

  if (!Array.isArray(value)) {
    return { error: "Scopes are invalid" };
  }

  const scopes: ScopeInput[] = [];

  for (const rawScope of value) {
    if (!rawScope || typeof rawScope !== "object") {
      return { error: "Each scope must be an object" };
    }

    const scope = rawScope as Record<string, unknown>;
    const materialItems: MaterialItemInput[] = [];
    const labourItems: LabourItemInput[] = [];
    const scopeCharges: ScopeChargeInput[] = [];
    const scopeQuantity = scope.quantity === undefined ? 1 : Number(scope.quantity);

    if (!Number.isFinite(scopeQuantity) || scopeQuantity <= 0) {
      return { error: "Scope quantity must be greater than zero" };
    }

    for (const rawMaterial of getArray(scope.material_items)) {
      if (!rawMaterial || typeof rawMaterial !== "object") {
        return { error: "Each material item must be an object" };
      }

      const material = rawMaterial as Record<string, unknown>;

      if (!hasMaterialValue(material)) {
        continue;
      }

      if (!trimText(material.material_description)) {
        return { error: "Each material row must include a description" };
      }

      for (const [value, label] of [
        [material.quantity, "Material quantity"],
        [material.unit_cost, "Material unit cost"],
        [material.profit_value, "Material profit value"],
      ] as const) {
        if (!isValidDecimalInput(value)) {
          return { error: `${label} must be a valid positive number` };
        }
      }

      materialItems.push({
        id: trimText(material.id) || undefined,
        material_description: trimText(material.material_description),
        material_category: trimText(material.material_category) || null,
        supplier_name: trimText(material.supplier_name) || null,
        supplier_quote_reference:
          trimText(material.supplier_quote_reference) || null,
        quantity: material.quantity as string | number | null,
        unit_cost: material.unit_cost as string | number | null,
        profit_type:
          trimText(material.profit_type) === "amount"
            ? "amount"
            : "percentage",
        profit_value: material.profit_value as string | number | null,
      });
    }

    for (const rawLabour of getArray(scope.labour_items)) {
      if (!rawLabour || typeof rawLabour !== "object") {
        return { error: "Each labour item must be an object" };
      }

      const labour = rawLabour as Record<string, unknown>;

      if (!hasLabourValue(labour)) {
        continue;
      }

      if (!trimText(labour.labour_description)) {
        return { error: "Each labour row must include a description" };
      }

      labourItems.push({
        id: trimText(labour.id) || undefined,
        labour_description: trimText(labour.labour_description),
        total_hours: labour.total_hours as string | number | null,
        number_of_workers: labour.number_of_workers as string | number | null,
        number_of_days: labour.number_of_days as string | number | null,
        hours_per_day: labour.hours_per_day as string | number | null,
        work_type: trimText(labour.work_type) || "regular",
      });
    }

    for (const rawCharge of getArray(scope.scope_charges)) {
      if (!rawCharge || typeof rawCharge !== "object") {
        return { error: "Each additional charge must be an object" };
      }

      const charge = rawCharge as Record<string, unknown>;

      if (!hasChargeValue(charge)) {
        continue;
      }

      if (!trimText(charge.description)) {
        return { error: "Each additional charge must include a description" };
      }

      for (const [value, label] of [
        [charge.amount, "Additional charge amount"],
        [charge.profit_value, "Additional charge profit value"],
      ] as const) {
        if (!isValidDecimalInput(value)) {
          return { error: `${label} must be a valid positive number` };
        }
      }

      scopeCharges.push({
        id: trimText(charge.id) || undefined,
        description: trimText(charge.description),
        amount: charge.amount as string | number | null,
        profit_type:
          trimText(charge.profit_type) === "amount"
            ? "amount"
            : "percentage",
        profit_value: charge.profit_value as string | number | null,
      });
    }

    scopes.push({
      id: trimText(scope.id) || undefined,
      scope_title: trimText(scope.scope_title) || "Scope of Work",
      scope_description: trimText(scope.scope_description) || null,
      quantity: scopeQuantity,
      labour_calculation_method:
        trimText(scope.labour_calculation_method) || "hourly",
      regular_hourly_rate: scope.regular_hourly_rate as string | number | null,
      overtime_hourly_rate: scope.overtime_hourly_rate as string | number | null,
      discount_type: trimText(scope.discount_type) || "none",
      discount_value: scope.discount_value as string | number | null,
      material_items: materialItems,
      labour_items: labourItems,
      scope_charges: scopeCharges,
    });
  }

  return { value: scopes };
}

export async function replaceQuotationScopes(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
  scopes: ScopeInput[],
) {
  const [
    existingScopesResult,
    existingMaterialsResult,
    existingLabourResult,
    existingChargesResult,
  ] = await Promise.all([
    admin
      .from("quotation_scopes")
      .select("id")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
    admin
      .from("quotation_material_items")
      .select("id, scope_id")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
    admin
      .from("quotation_labour_items")
      .select("id, scope_id")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
    admin
      .from("quotation_scope_charges")
      .select("id, scope_id")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
  ]);

  for (const result of [
    existingScopesResult,
    existingMaterialsResult,
    existingLabourResult,
    existingChargesResult,
  ]) {
    if (result.error) {
      return { error: result.error };
    }
  }

  const existingScopeIds = new Set(
    ((existingScopesResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    ),
  );
  const existingMaterialIds = new Set(
    ((existingMaterialsResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    ),
  );
  const existingLabourIds = new Set(
    ((existingLabourResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    ),
  );
  const existingChargeIds = new Set(
    ((existingChargesResult.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    ),
  );
  const { scopes: calculatedScopes, totals } = calculateQuotationTotals(scopes);
  const scopeRows = calculatedScopes.map((scope, index) => ({
    id: scope.id && existingScopeIds.has(scope.id) ? scope.id : crypto.randomUUID(),
    org_id: orgId,
    quotation_id: quotationId,
    scope_title: scope.scope_title,
    scope_description: scope.scope_description ?? null,
    quantity: scope.quantity,
    sort_order: index + 1,
    labour_calculation_method: scope.labour_calculation_method,
    regular_hourly_rate: scope.regular_hourly_rate,
    overtime_hourly_rate: scope.overtime_hourly_rate,
    material_total: scope.material_total,
    material_profit_total: scope.material_profit_total,
    labour_total: scope.labour_total,
    additional_charges_total: scope.additional_charges_total,
    scope_subtotal_before_discount: scope.scope_subtotal_before_discount,
    discount_type: scope.discount_type,
    discount_value: scope.discount_value,
    discount_amount: scope.discount_amount,
    scope_total_after_discount: scope.scope_total_after_discount,
  }));
  const materialRows = calculatedScopes.flatMap((scope, scopeIndex) =>
    scope.material_items.map((item, itemIndex) => ({
      id:
        item.id && existingMaterialIds.has(item.id)
          ? item.id
          : crypto.randomUUID(),
      org_id: orgId,
      quotation_id: quotationId,
      scope_id: scopeRows[scopeIndex].id,
      material_description: item.material_description,
      material_category: item.material_category ?? null,
      supplier_name: item.supplier_name ?? null,
      supplier_quote_reference: item.supplier_quote_reference ?? null,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      material_cost: item.material_cost,
      profit_type: item.profit_type,
      profit_value: item.profit_value,
      profit_amount: item.profit_amount,
      line_total: item.line_total,
      sort_order: itemIndex + 1,
    })),
  );
  const labourRows = calculatedScopes.flatMap((scope, scopeIndex) =>
    scope.labour_items.map((item, itemIndex) => {
      const isCrew = scope.labour_calculation_method === "crew";

      return {
        id:
          item.id && existingLabourIds.has(item.id)
            ? item.id
            : crypto.randomUUID(),
        org_id: orgId,
        quotation_id: quotationId,
        scope_id: scopeRows[scopeIndex].id,
        labour_description: item.labour_description,
        calculation_method: scope.labour_calculation_method,
        total_hours: isCrew ? null : toPositiveNumber(item.total_hours),
        number_of_workers: isCrew
          ? toPositiveNumber(item.number_of_workers)
          : null,
        number_of_days: isCrew ? toPositiveNumber(item.number_of_days) : null,
        hours_per_day: isCrew ? toPositiveNumber(item.hours_per_day) : null,
        work_type: item.work_type,
        regular_hours: item.regular_hours,
        overtime_hours: item.overtime_hours,
        regular_rate: item.regular_rate,
        overtime_rate: item.overtime_rate,
        regular_cost: item.regular_cost,
        overtime_cost: item.overtime_cost,
        total_cost: item.total_cost,
        sort_order: itemIndex + 1,
      };
    }),
  );
  const chargeRows = calculatedScopes.flatMap((scope, scopeIndex) =>
    scope.scope_charges.map((charge, chargeIndex) => ({
      id:
        charge.id && existingChargeIds.has(charge.id)
          ? charge.id
          : crypto.randomUUID(),
      org_id: orgId,
      quotation_id: quotationId,
      scope_id: scopeRows[scopeIndex].id,
      description: charge.description,
      amount: charge.amount,
      profit_type: charge.profit_type,
      profit_value: charge.profit_value,
      profit_amount: charge.profit_amount,
      line_total: charge.line_total,
      sort_order: chargeIndex + 1,
    })),
  );
  const nextScopeIds = new Set(scopeRows.map((row) => row.id));
  const nextMaterialIds = new Set(materialRows.map((row) => row.id));
  const nextLabourIds = new Set(labourRows.map((row) => row.id));
  const nextChargeIds = new Set(chargeRows.map((row) => row.id));
  const scopeIdsToDelete = Array.from(existingScopeIds).filter(
    (id) => !nextScopeIds.has(id),
  );
  const materialIdsToDelete = Array.from(existingMaterialIds).filter(
    (id) => !nextMaterialIds.has(id),
  );
  const labourIdsToDelete = Array.from(existingLabourIds).filter(
    (id) => !nextLabourIds.has(id),
  );
  const chargeIdsToDelete = Array.from(existingChargeIds).filter(
    (id) => !nextChargeIds.has(id),
  );

  const deleteMaterial =
    materialIdsToDelete.length > 0
      ? await admin
          .from("quotation_material_items")
          .delete()
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .in("id", materialIdsToDelete)
      : { error: null };

  if (deleteMaterial.error) {
    return { error: deleteMaterial.error };
  }

  const deleteLabour =
    labourIdsToDelete.length > 0
      ? await admin
          .from("quotation_labour_items")
          .delete()
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .in("id", labourIdsToDelete)
      : { error: null };

  if (deleteLabour.error) {
    return { error: deleteLabour.error };
  }

  const deleteCharges =
    chargeIdsToDelete.length > 0
      ? await admin
          .from("quotation_scope_charges")
          .delete()
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .in("id", chargeIdsToDelete)
      : { error: null };

  if (deleteCharges.error) {
    return { error: deleteCharges.error };
  }

  const deleteCustomerDocumentItems =
    scopeIdsToDelete.length > 0
      ? await admin
          .from("quotation_customer_document_items")
          .delete()
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .in("scope_id", scopeIdsToDelete)
      : { error: null };

  if (deleteCustomerDocumentItems.error) {
    return { error: deleteCustomerDocumentItems.error };
  }

  const deleteScopes =
    scopeIdsToDelete.length > 0
      ? await admin
          .from("quotation_scopes")
          .delete()
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .in("id", scopeIdsToDelete)
      : { error: null };

  if (deleteScopes.error) {
    return { error: deleteScopes.error };
  }

  if (scopeRows.length > 0) {
    const { error } = await admin
      .from("quotation_scopes")
      .upsert(scopeRows, { onConflict: "id" });

    if (error) {
      return { error };
    }
  }

  if (materialRows.length > 0) {
    const { error } = await admin
      .from("quotation_material_items")
      .upsert(materialRows, { onConflict: "id" });

    if (error) {
      return { error };
    }
  }

  if (labourRows.length > 0) {
    const { error } = await admin
      .from("quotation_labour_items")
      .upsert(labourRows, { onConflict: "id" });

    if (error) {
      return { error };
    }
  }

  if (chargeRows.length > 0) {
    const { error } = await admin
      .from("quotation_scope_charges")
      .upsert(chargeRows, { onConflict: "id" });

    if (error) {
      return { error };
    }
  }

  return { totals, scopes: calculatedScopes };
}

export async function replaceFinalAdjustments(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
  adjustments: FinalAdjustmentInput[],
  scopesSubtotal: number,
) {
  const calculated = calculateFinalTotals({
    scopeTotals: {
      material_total: 0,
      material_profit_total: 0,
      labour_total: 0,
      scope_additional_charges_total: 0,
      scopes_subtotal: scopesSubtotal,
      scopes_discount_total: 0,
      grand_total_before_tax: scopesSubtotal,
    },
    finalAdjustments: adjustments,
  }).final_adjustments;
  const { error: deleteError } = await admin
    .from("quotation_final_adjustments")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteError) {
    return { error: deleteError };
  }

  if (calculated.length === 0) {
    return { adjustments: calculated };
  }

  const rows = calculated.map((adjustment, index) => ({
    org_id: orgId,
    quotation_id: quotationId,
    adjustment_type: "additional_charge",
    description: adjustment.description,
    calculation_type: adjustment.calculation_type,
    value: adjustment.value,
    calculated_amount: adjustment.calculated_amount,
    sort_order: index + 1,
  }));
  const { error } = await admin
    .from("quotation_final_adjustments")
    .insert(rows);

  return error ? { error } : { adjustments: calculated };
}

export async function replaceNoteSections(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
  sections: NoteSectionInput[],
) {
  const { error: deleteError } = await admin
    .from("quotation_note_sections")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteError) {
    return { error: deleteError };
  }

  const rows = sections.map((section) => ({
    org_id: orgId,
    quotation_id: quotationId,
    section_type: section.section_type,
    title: section.title,
    body_text: section.body_text ?? "",
    body_html: section.body_text ?? "",
    visible_to_customer: section.section_type !== "internal_notes",
  }));

  if (rows.length === 0) {
    return { sections };
  }

  const { error } = await admin.from("quotation_note_sections").insert(rows);

  return error ? { error } : { sections };
}

export async function calculateFinalQuotationTotals(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
  customerId: string,
  scopeTotals: {
    material_total: number;
    material_profit_total: number;
    labour_total: number;
    scope_additional_charges_total: number;
    scopes_subtotal: number;
    scopes_discount_total: number;
    grand_total_before_tax: number;
  },
  finalDiscountType: string | null | undefined,
  finalDiscountValue: number | string | null | undefined,
  finalAdjustments: FinalAdjustmentInput[],
) {
  const taxInfo = await getCustomerTaxInfo(admin, orgId, customerId);
  const totals = calculateFinalTotals({
    scopeTotals,
    finalDiscountType,
    finalDiscountValue,
    finalAdjustments,
    taxRate: taxInfo.taxRate,
  });

  return { totals, taxInfo, quotationId };
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
}

async function fetchProfiles(admin: SupabaseClient, profileIds: string[]) {
  const { data, error } =
    profileIds.length > 0
      ? await admin.from("profiles").select("id, full_name, email").in("id", profileIds)
      : { data: [], error: null };

  if (error) {
    return { error };
  }

  const profilesById = new Map<string, ProfileRow>();

  for (const profile of (data ?? []) as ProfileRow[]) {
    profilesById.set(profile.id, profile);
  }

  return { profilesById };
}

async function fetchCustomers(
  admin: SupabaseClient,
  orgId: string,
  customerIds: string[],
) {
  const { data, error } =
    customerIds.length > 0
      ? await admin
          .from("customers")
          .select("id, company_name, customer_code, legal_company_name")
          .eq("org_id", orgId)
          .in("id", customerIds)
      : { data: [], error: null };

  if (error) {
    return { error };
  }

  const customersById = new Map<string, CustomerRow>();

  for (const customer of (data ?? []) as CustomerRow[]) {
    customersById.set(customer.id, customer);
  }

  return { customersById };
}

export async function listQuotations(
  admin: SupabaseClient,
  orgId: string,
  filters: { search: string; status: string },
) {
  let query = admin
    .from("quotations")
    .select("*")
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    return { error };
  }

  const quotationRows = (data ?? []) as QuotationRow[];
  const customerIds = uniqueStrings(
    quotationRows.map((quotation) => quotation.customer_id),
  );
  const profileIds = uniqueStrings(
    quotationRows.flatMap((quotation) => [
      quotation.prepared_by,
      quotation.sales_rep_id,
    ]),
  );
  const [customersResult, profilesResult] = await Promise.all([
    fetchCustomers(admin, orgId, customerIds),
    fetchProfiles(admin, profileIds),
  ]);

  if (customersResult.error) {
    return { error: customersResult.error };
  }

  if (profilesResult.error) {
    return { error: profilesResult.error };
  }

  const customersById = customersResult.customersById ?? new Map();
  const profilesById = profilesResult.profilesById ?? new Map();
  const search = filters.search.toLowerCase();
  const quotations = quotationRows
    .filter((quotation) => {
      if (!search) {
        return true;
      }

      const customer = customersById.get(quotation.customer_id);
      const haystack = [
        quotation.quotation_number,
        quotation.project_name,
        quotation.customer_rfq_number,
        customer?.company_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .map((quotation) => ({
      ...quotation,
      customer: customersById.get(quotation.customer_id) ?? null,
      prepared_by_profile: quotation.prepared_by
        ? (profilesById.get(quotation.prepared_by) ?? null)
        : null,
      sales_rep_profile: quotation.sales_rep_id
        ? (profilesById.get(quotation.sales_rep_id) ?? null)
        : null,
      grand_total:
        quotation.grand_total_after_tax ??
        quotation.grand_total_before_tax ??
        0,
      updated_at: quotation.updated_at ?? quotation.created_at ?? null,
    }));

  return { quotations };
}

export async function getQuotationDetail(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
) {
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quotationError) {
    return { error: quotationError };
  }

  if (!quotation) {
    return { notFound: true };
  }

  const quotationRow = quotation as QuotationRow;
  const [
    contactsResult,
    customersResult,
    profilesResult,
    scopesResult,
    materialsResult,
    labourResult,
    chargesResult,
    documentsResult,
    chargeDocumentsResult,
    finalAdjustmentsResult,
    notesResult,
    statusHistoryResult,
    revisionsResult,
  ] = await Promise.all([
    admin
      .from("quotation_contacts")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: true }),
    fetchCustomers(admin, orgId, [quotationRow.customer_id]),
    fetchProfiles(
      admin,
      uniqueStrings([quotationRow.prepared_by, quotationRow.sales_rep_id]),
    ),
    admin
      .from("quotation_scopes")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("quotation_material_items")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("quotation_labour_items")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("quotation_scope_charges")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("quotation_material_documents")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
    admin
      .from("quotation_scope_charge_documents")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
    admin
      .from("quotation_final_adjustments")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    admin
      .from("quotation_note_sections")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("section_type", { ascending: true }),
    admin
      .from("quotation_status_history")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false }),
    admin
      .from("quotation_revisions")
      .select("*")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("created_at", { ascending: false }),
  ]);

  if (contactsResult.error) {
    return { error: contactsResult.error };
  }

  if (customersResult.error) {
    return { error: customersResult.error };
  }

  if (profilesResult.error) {
    return { error: profilesResult.error };
  }

  if (scopesResult.error) {
    return { error: scopesResult.error };
  }

  if (materialsResult.error) {
    return { error: materialsResult.error };
  }

  if (labourResult.error) {
    return { error: labourResult.error };
  }

  if (chargesResult.error) {
    return { error: chargesResult.error };
  }

  if (documentsResult.error) {
    return { error: documentsResult.error };
  }

  if (chargeDocumentsResult.error) {
    return { error: chargeDocumentsResult.error };
  }

  if (finalAdjustmentsResult.error) {
    return { error: finalAdjustmentsResult.error };
  }

  if (notesResult.error) {
    return { error: notesResult.error };
  }

  if (statusHistoryResult.error) {
    return { error: statusHistoryResult.error };
  }

  if (revisionsResult.error) {
    return { error: revisionsResult.error };
  }

  const customersById = customersResult.customersById ?? new Map();
  const profilesById = profilesResult.profilesById ?? new Map();
  const taxInfo = await getCustomerTaxInfo(
    admin,
    orgId,
    quotationRow.customer_id,
  );
  const materialsByScope = new Map<string, MaterialWithDocument[]>();
  const labourByScope = new Map<string, LabourRow[]>();
  const chargesByScope = new Map<string, ChargeWithDocument[]>();
  const documentsByMaterial = new Map<string, MaterialDocumentRow>();
  const documentsByCharge = new Map<string, ChargeDocumentRow>();

  for (const document of (documentsResult.data ?? []) as MaterialDocumentRow[]) {
    let signedUrl: string | null = null;

    if (document.file_path) {
      const { data: signedData } = await admin.storage
        .from(document.storage_bucket || "quotation-documents")
        .createSignedUrl(document.file_path, 10 * 60);

      signedUrl = signedData?.signedUrl ?? null;
    }

    documentsByMaterial.set(document.material_item_id, {
      ...document,
      signed_url: signedUrl,
    });
  }

  for (const material of (materialsResult.data ?? []) as MaterialRow[]) {
    const existing = materialsByScope.get(material.scope_id) ?? [];
    existing.push({
      ...material,
      is_persisted: true,
      supplier_quote_document: documentsByMaterial.get(material.id) ?? null,
    });
    materialsByScope.set(material.scope_id, existing);
  }

  for (const document of (chargeDocumentsResult.data ??
    []) as ChargeDocumentRow[]) {
    let signedUrl: string | null = null;

    if (document.file_path) {
      const { data: signedData } = await admin.storage
        .from(document.storage_bucket || "quotation-documents")
        .createSignedUrl(document.file_path, 10 * 60);

      signedUrl = signedData?.signedUrl ?? null;
    }

    documentsByCharge.set(document.scope_charge_id, {
      ...document,
      signed_url: signedUrl,
    });
  }

  for (const labour of (labourResult.data ?? []) as LabourRow[]) {
    const existing = labourByScope.get(labour.scope_id) ?? [];
    existing.push(labour);
    labourByScope.set(labour.scope_id, existing);
  }

  for (const charge of (chargesResult.data ?? []) as ChargeRow[]) {
    const existing = chargesByScope.get(charge.scope_id) ?? [];
    existing.push({
      ...charge,
      is_persisted: true,
      supporting_document: documentsByCharge.get(charge.id) ?? null,
    });
    chargesByScope.set(charge.scope_id, existing);
  }

  return {
    quotation: {
      ...quotationRow,
      customer: customersById.get(quotationRow.customer_id) ?? null,
      prepared_by_profile: quotationRow.prepared_by
        ? (profilesById.get(quotationRow.prepared_by) ?? null)
        : null,
      sales_rep_profile: quotationRow.sales_rep_id
        ? (profilesById.get(quotationRow.sales_rep_id) ?? null)
        : null,
      grand_total:
        quotationRow.grand_total_after_tax ??
        quotationRow.grand_total_before_tax ??
        0,
    },
    contacts: (contactsResult.data ?? []) as QuotationContactRow[],
    scopes: ((scopesResult.data ?? []) as ScopeRow[]).map((scope) => ({
      ...scope,
      material_items: materialsByScope.get(scope.id) ?? [],
      labour_items: labourByScope.get(scope.id) ?? [],
      scope_charges: chargesByScope.get(scope.id) ?? [],
    })),
    final_adjustments:
      (finalAdjustmentsResult.data ?? []) as FinalAdjustmentRow[],
    note_sections: (notesResult.data ?? []) as NoteSectionRow[],
    status_history: statusHistoryResult.data ?? [],
    revisions: revisionsResult.data ?? [],
    tax_warning: taxInfo.warning,
  };
}
