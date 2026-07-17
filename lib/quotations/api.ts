import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateQuotationTotals,
  toPositiveNumber,
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
  grand_total_before_tax?: number | string | null;
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

export const quotationStatuses = new Set([
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
  "converted",
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
    item.unit,
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
  return [item.description, item.amount].some(
    (value) => String(value ?? "").trim().length > 0,
  );
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

      materialItems.push({
        material_description: trimText(material.material_description),
        material_category: trimText(material.material_category) || null,
        supplier_name: trimText(material.supplier_name) || null,
        supplier_quote_reference:
          trimText(material.supplier_quote_reference) || null,
        quantity: material.quantity as string | number | null,
        unit: trimText(material.unit) || null,
        unit_cost: material.unit_cost as string | number | null,
        profit_type: trimText(material.profit_type) || "none",
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

      scopeCharges.push({
        description: trimText(charge.description),
        amount: charge.amount as string | number | null,
      });
    }

    scopes.push({
      scope_title: trimText(scope.scope_title) || "Scope of Work",
      scope_description: trimText(scope.scope_description) || null,
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
  const { scopes: calculatedScopes, totals } = calculateQuotationTotals(scopes);
  const scopeRows = calculatedScopes.map((scope, index) => ({
    id: crypto.randomUUID(),
    org_id: orgId,
    quotation_id: quotationId,
    scope_title: scope.scope_title,
    scope_description: scope.scope_description ?? null,
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
      org_id: orgId,
      quotation_id: quotationId,
      scope_id: scopeRows[scopeIndex].id,
      material_description: item.material_description,
      material_category: item.material_category ?? null,
      supplier_name: item.supplier_name ?? null,
      supplier_quote_reference: item.supplier_quote_reference ?? null,
      quantity: item.quantity,
      unit: item.unit ?? null,
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
      org_id: orgId,
      quotation_id: quotationId,
      scope_id: scopeRows[scopeIndex].id,
      description: charge.description,
      amount: charge.amount,
      sort_order: chargeIndex + 1,
    })),
  );

  const deleteMaterial = await admin
    .from("quotation_material_items")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteMaterial.error) {
    return { error: deleteMaterial.error };
  }

  const deleteLabour = await admin
    .from("quotation_labour_items")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteLabour.error) {
    return { error: deleteLabour.error };
  }

  const deleteCharges = await admin
    .from("quotation_scope_charges")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteCharges.error) {
    return { error: deleteCharges.error };
  }

  const deleteScopes = await admin
    .from("quotation_scopes")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  if (deleteScopes.error) {
    return { error: deleteScopes.error };
  }

  if (scopeRows.length > 0) {
    const { error } = await admin.from("quotation_scopes").insert(scopeRows);

    if (error) {
      return { error };
    }
  }

  if (materialRows.length > 0) {
    const { error } = await admin
      .from("quotation_material_items")
      .insert(materialRows);

    if (error) {
      return { error };
    }
  }

  if (labourRows.length > 0) {
    const { error } = await admin
      .from("quotation_labour_items")
      .insert(labourRows);

    if (error) {
      return { error };
    }
  }

  if (chargeRows.length > 0) {
    const { error } = await admin
      .from("quotation_scope_charges")
      .insert(chargeRows);

    if (error) {
      return { error };
    }
  }

  return { totals, scopes: calculatedScopes };
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

  const customersById = customersResult.customersById ?? new Map();
  const profilesById = profilesResult.profilesById ?? new Map();
  const materialsByScope = new Map<string, MaterialRow[]>();
  const labourByScope = new Map<string, LabourRow[]>();
  const chargesByScope = new Map<string, ChargeRow[]>();

  for (const material of (materialsResult.data ?? []) as MaterialRow[]) {
    const existing = materialsByScope.get(material.scope_id) ?? [];
    existing.push(material);
    materialsByScope.set(material.scope_id, existing);
  }

  for (const labour of (labourResult.data ?? []) as LabourRow[]) {
    const existing = labourByScope.get(labour.scope_id) ?? [];
    existing.push(labour);
    labourByScope.set(labour.scope_id, existing);
  }

  for (const charge of (chargesResult.data ?? []) as ChargeRow[]) {
    const existing = chargesByScope.get(charge.scope_id) ?? [];
    existing.push(charge);
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
  };
}
