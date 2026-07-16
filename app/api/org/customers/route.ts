import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

type CustomerRow = {
  id: string;
  company_name: string;
  legal_company_name?: string | null;
  customer_code?: string | null;
  industry?: string | null;
  customer_status: string;
  assigned_sales_rep_id?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type ContactRow = {
  customer_id: string;
  first_name: string;
  last_name?: string | null;
  email?: string | null;
  office_phone?: string | null;
  mobile_number?: string | null;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type CustomerTagRow = {
  customer_id: string;
  tag_id: string;
};

type TagRow = {
  id: string;
  name: string;
  color: string;
};

type CustomerAddressInput = {
  address_line_1?: unknown;
  address_line_2?: unknown;
  city?: unknown;
  province_state?: unknown;
  postal_code?: unknown;
  country?: unknown;
  same_as_head_office?: unknown;
};

type CustomerContactInput = {
  first_name?: unknown;
  last_name?: unknown;
  job_title?: unknown;
  department?: unknown;
  email?: unknown;
  mobile_number?: unknown;
  office_phone?: unknown;
  extension?: unknown;
  is_primary?: unknown;
  notes?: unknown;
};

type CreateCustomerBody = {
  company_name?: unknown;
  legal_company_name?: unknown;
  industry?: unknown;
  business_category?: unknown;
  company_type?: unknown;
  business_registration_number?: unknown;
  gst_hst_number?: unknown;
  vendor_number?: unknown;
  assigned_sales_rep_id?: unknown;
  account_manager_id?: unknown;
  lead_source?: unknown;
  referral_source?: unknown;
  customer_since?: unknown;
  customer_status?: unknown;
  credit_limit?: unknown;
  credit_terms?: unknown;
  tax_exempt?: unknown;
  currency?: unknown;
  preferred_payment_method?: unknown;
  accounts_payable_email?: unknown;
  invoice_email?: unknown;
  addresses?: {
    head_office?: CustomerAddressInput;
    billing?: CustomerAddressInput;
  };
  contacts?: CustomerContactInput[];
};

type AddressInsert = {
  org_id: string;
  customer_id: string;
  address_type: "head_office" | "billing";
  same_as_head_office: boolean;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  province_state: string | null;
  postal_code: string | null;
  country: string;
  created_by: string;
};

type ContactInsert = {
  org_id: string;
  customer_id: string;
  first_name: string;
  last_name: string | null;
  job_title: string | null;
  department: string | null;
  email: string | null;
  mobile_number: string | null;
  office_phone: string | null;
  extension: string | null;
  is_primary: boolean;
  notes: string | null;
  created_by: string;
};

const allowedRoles = new Set(["admin", "sales", "accountant"]);
const companyTypes = new Set([
  "manufacturer",
  "distributor",
  "supplier",
  "importer",
  "exporter",
  "contractor",
  "food_processing",
  "dairy",
  "bakery",
  "brewery",
  "pharmaceutical",
  "chemical",
  "packaging",
  "engineering",
  "other",
]);
const customerStatuses = new Set([
  "prospect",
  "active",
  "inactive",
  "blacklisted",
]);
const creditTerms = new Set([
  "due_on_receipt",
  "net_15",
  "net_30",
  "net_45",
  "net_60",
]);
const currencies = new Set(["CAD", "USD", "EUR"]);
const paymentMethods = new Set([
  "eft",
  "cheque",
  "wire_transfer",
  "credit_card",
]);
const contactDepartments = new Set([
  "purchasing",
  "engineering",
  "production",
  "operations",
  "maintenance",
  "finance",
  "accounts_payable",
  "accounts_receivable",
  "shipping",
  "receiving",
  "quality",
  "administration",
  "other",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalString(value: unknown) {
  const text = getString(value);
  return text ? text : null;
}

function getOptionalEnum(
  value: unknown,
  allowedValues: Set<string>,
  fieldName: string,
) {
  const text = getString(value);

  if (!text) {
    return { value: null };
  }

  if (!allowedValues.has(text)) {
    return { error: `${fieldName} is invalid` };
  }

  return { value: text };
}

function getOptionalDate(value: unknown) {
  const text = getString(value);

  if (!text) {
    return { value: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { error: "Customer since must be a valid date" };
  }

  return { value: text };
}

function getCreditLimit(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return { value: 0 };
  }

  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return { error: "Credit limit must be a positive number" };
  }

  return { value: numberValue };
}

function splitCsvParam(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const tagId = searchParams.get("tag_id")?.trim() ?? "";

  const admin = createAdminClient();
  let customerIdsFromTag: string[] | null = null;

  if (tagId) {
    const { data: tagRows, error: tagError } = await admin
      .from("customer_tags")
      .select("customer_id")
      .eq("org_id", session.org_id)
      .eq("tag_id", tagId);

    if (tagError) {
      return jsonError("Unable to filter customers by tag", 500);
    }

    customerIdsFromTag = (tagRows ?? []).map(
      (row) => (row as Pick<CustomerTagRow, "customer_id">).customer_id,
    );

    if (customerIdsFromTag.length === 0) {
      return NextResponse.json({ customers: [], tags: [] });
    }
  }

  let customerQuery = admin
    .from("customers")
    .select(
      "id, company_name, legal_company_name, customer_code, industry, customer_status, assigned_sales_rep_id, updated_at, created_at",
    )
    .eq("org_id", session.org_id)
    .neq("record_status", "deleted")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (search) {
    const safeSearch = search.replaceAll("%", "\\%").replaceAll("_", "\\_");
    customerQuery = customerQuery.or(
      [
        `company_name.ilike.%${safeSearch}%`,
        `legal_company_name.ilike.%${safeSearch}%`,
        `customer_code.ilike.%${safeSearch}%`,
      ].join(","),
    );
  }

  if (status) {
    customerQuery = customerQuery.eq("customer_status", status);
  }

  if (customerIdsFromTag) {
    customerQuery = customerQuery.in("id", customerIdsFromTag);
  }

  const { data: customerRows, error: customersError } = await customerQuery;

  if (customersError) {
    return jsonError("Unable to fetch customers", 500);
  }

  const customers = (customerRows ?? []) as CustomerRow[];
  const customerIds = customers.map((customer) => customer.id);
  const salesRepIds = customers
    .map((customer) => customer.assigned_sales_rep_id)
    .filter((id): id is string => Boolean(id));

  const [
    primaryContactsResult,
    customerTagsResult,
    tagsResult,
    salesRepsResult,
  ] = await Promise.all([
    customerIds.length > 0
      ? admin
          .from("customer_contacts")
          .select(
            "customer_id, first_name, last_name, email, office_phone, mobile_number",
          )
          .eq("org_id", session.org_id)
          .eq("is_primary", true)
          .neq("status", "deleted")
          .in("customer_id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    customerIds.length > 0
      ? admin
          .from("customer_tags")
          .select("customer_id, tag_id")
          .eq("org_id", session.org_id)
          .in("customer_id", customerIds)
      : Promise.resolve({ data: [], error: null }),
    admin
      .from("tags")
      .select("id, name, color")
      .eq("org_id", session.org_id)
      .eq("status", "active")
      .order("name", { ascending: true }),
    salesRepIds.length > 0
      ? admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(new Set(salesRepIds)))
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (primaryContactsResult.error) {
    return jsonError("Unable to fetch primary contacts", 500);
  }

  if (customerTagsResult.error) {
    return jsonError("Unable to fetch customer tags", 500);
  }

  if (tagsResult.error) {
    return jsonError("Unable to fetch tags", 500);
  }

  if (salesRepsResult.error) {
    return jsonError("Unable to fetch assigned sales reps", 500);
  }

  const primaryContactsByCustomer = new Map<string, ContactRow>();
  for (const contact of (primaryContactsResult.data ?? []) as ContactRow[]) {
    primaryContactsByCustomer.set(contact.customer_id, contact);
  }

  const tagsById = new Map<string, TagRow>();
  for (const tag of (tagsResult.data ?? []) as TagRow[]) {
    tagsById.set(tag.id, tag);
  }

  const customerTagsByCustomer = new Map<string, TagRow[]>();
  for (const link of (customerTagsResult.data ?? []) as CustomerTagRow[]) {
    const tag = tagsById.get(link.tag_id);

    if (!tag) {
      continue;
    }

    const existing = customerTagsByCustomer.get(link.customer_id) ?? [];
    existing.push(tag);
    customerTagsByCustomer.set(link.customer_id, existing);
  }

  const salesRepsById = new Map<string, ProfileRow>();
  for (const profile of (salesRepsResult.data ?? []) as ProfileRow[]) {
    salesRepsById.set(profile.id, profile);
  }

  return NextResponse.json({
    customers: customers.map((customer) => ({
      id: customer.id,
      company_name: customer.company_name,
      legal_company_name: customer.legal_company_name ?? null,
      customer_code: customer.customer_code ?? null,
      industry: customer.industry ?? null,
      customer_status: customer.customer_status,
      primary_contact: primaryContactsByCustomer.get(customer.id) ?? null,
      assigned_sales_rep: customer.assigned_sales_rep_id
        ? (salesRepsById.get(customer.assigned_sales_rep_id) ?? null)
        : null,
      tags: customerTagsByCustomer.get(customer.id) ?? [],
      updated_at: customer.updated_at ?? customer.created_at ?? null,
    })),
    tags: (tagsResult.data ?? []) as TagRow[],
    filters: {
      search,
      status,
      tag_ids: splitCsvParam(tagId),
    },
  });
}

function buildAddress(
  input: CustomerAddressInput | undefined,
  addressType: "head_office" | "billing",
  orgId: string,
  customerId: string,
  userId: string,
  fallback?: CustomerAddressInput,
): AddressInsert {
  const sameAsHeadOffice = input?.same_as_head_office === true;
  const source = sameAsHeadOffice && fallback ? fallback : input;

  return {
    org_id: orgId,
    customer_id: customerId,
    address_type: addressType,
    same_as_head_office: sameAsHeadOffice,
    address_line_1: getOptionalString(source?.address_line_1),
    address_line_2: getOptionalString(source?.address_line_2),
    city: getOptionalString(source?.city),
    province_state: getOptionalString(source?.province_state),
    postal_code: getOptionalString(source?.postal_code),
    country: getOptionalString(source?.country) ?? "Canada",
    created_by: userId,
  };
}

function hasAnyContactValue(contact: CustomerContactInput) {
  return [
    contact.first_name,
    contact.last_name,
    contact.job_title,
    contact.department,
    contact.email,
    contact.mobile_number,
    contact.office_phone,
    contact.extension,
    contact.notes,
  ].some((value) => getString(value).length > 0);
}

function buildContacts(
  input: CustomerContactInput[] | undefined,
  orgId: string,
  customerId: string,
  userId: string,
) {
  const contacts = Array.isArray(input)
    ? input.filter((contact) => hasAnyContactValue(contact))
    : [];

  const primaryIndex = contacts.findIndex(
    (contact) => contact.is_primary === true,
  );
  const normalizedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const rows: ContactInsert[] = [];

  for (let index = 0; index < contacts.length; index += 1) {
    const contact = contacts[index];
    const firstName = getString(contact.first_name);

    if (!firstName) {
      return { error: "Each contact must include a first name" };
    }

    const department = getOptionalEnum(
      contact.department,
      contactDepartments,
      "Department",
    );

    if (department.error) {
      return { error: department.error };
    }

    rows.push({
      org_id: orgId,
      customer_id: customerId,
      first_name: firstName,
      last_name: getOptionalString(contact.last_name),
      job_title: getOptionalString(contact.job_title),
      department: department.value ?? null,
      email: getOptionalString(contact.email),
      mobile_number: getOptionalString(contact.mobile_number),
      office_phone: getOptionalString(contact.office_phone),
      extension: getOptionalString(contact.extension),
      is_primary: index === normalizedPrimaryIndex,
      notes: getOptionalString(contact.notes),
      created_by: userId,
    });
  }

  return { contacts: rows };
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  let body: CreateCustomerBody;

  try {
    body = (await request.json()) as CreateCustomerBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const companyName = getString(body.company_name);

  if (!companyName) {
    return jsonError("Company name is required", 400);
  }

  const companyType = getOptionalEnum(
    body.company_type,
    companyTypes,
    "Company type",
  );
  const customerStatus = getOptionalEnum(
    body.customer_status,
    customerStatuses,
    "Customer status",
  );
  const selectedCreditTerms = getOptionalEnum(
    body.credit_terms,
    creditTerms,
    "Credit terms",
  );
  const currency = getOptionalEnum(body.currency, currencies, "Currency");
  const preferredPaymentMethod = getOptionalEnum(
    body.preferred_payment_method,
    paymentMethods,
    "Preferred payment method",
  );
  const customerSince = getOptionalDate(body.customer_since);
  const creditLimit = getCreditLimit(body.credit_limit);

  for (const result of [
    companyType,
    customerStatus,
    selectedCreditTerms,
    currency,
    preferredPaymentMethod,
    customerSince,
    creditLimit,
  ]) {
    if (result.error) {
      return jsonError(result.error, 400);
    }
  }

  const contactsResult = buildContacts(
    body.contacts,
    session.org_id,
    "",
    session.user.id,
  );

  if (contactsResult.error) {
    return jsonError(contactsResult.error, 400);
  }

  const admin = createAdminClient();
  const assignedSalesRepId = getOptionalString(body.assigned_sales_rep_id);
  const accountManagerId = getOptionalString(body.account_manager_id);
  const assigneeIds = Array.from(
    new Set([assignedSalesRepId, accountManagerId].filter(Boolean)),
  ) as string[];

  if (assigneeIds.length > 0) {
    const { data: memberships, error: assigneeError } = await admin
      .from("org_members")
      .select("user_id")
      .eq("org_id", session.org_id)
      .eq("status", "active")
      .in("user_id", assigneeIds);

    if (assigneeError) {
      return jsonError("Unable to validate assignees", 500);
    }

    const validAssigneeIds = new Set(
      (memberships ?? []).map((membership) => membership.user_id as string),
    );

    if (assigneeIds.some((assigneeId) => !validAssigneeIds.has(assigneeId))) {
      return jsonError("Assigned users must be active organization members", 400);
    }
  }

  const customerInsert = {
    org_id: session.org_id,
    company_name: companyName,
    legal_company_name: getOptionalString(body.legal_company_name),
    industry: getOptionalString(body.industry),
    business_category: getOptionalString(body.business_category),
    company_type: companyType.value,
    business_registration_number: getOptionalString(
      body.business_registration_number,
    ),
    gst_hst_number: getOptionalString(body.gst_hst_number),
    vendor_number: getOptionalString(body.vendor_number),
    assigned_sales_rep_id: assignedSalesRepId,
    account_manager_id: accountManagerId,
    lead_source: getOptionalString(body.lead_source),
    referral_source: getOptionalString(body.referral_source),
    customer_since: customerSince.value,
    customer_status: customerStatus.value ?? "prospect",
    credit_limit: creditLimit.value,
    credit_terms: selectedCreditTerms.value ?? "net_30",
    tax_exempt: body.tax_exempt === true,
    currency: currency.value ?? "CAD",
    preferred_payment_method: preferredPaymentMethod.value,
    accounts_payable_email: getOptionalString(body.accounts_payable_email),
    invoice_email: getOptionalString(body.invoice_email),
    record_status: "active",
    created_by: session.user.id,
  };

  const { data: createdCustomer, error: customerError } = await admin
    .from("customers")
    .insert(customerInsert)
    .select("id, customer_code, company_name")
    .single();

  if (customerError || !createdCustomer) {
    return jsonError("Unable to create customer", 500);
  }

  const customerId = createdCustomer.id as string;
  const addressRows = [
    buildAddress(
      body.addresses?.head_office,
      "head_office",
      session.org_id,
      customerId,
      session.user.id,
    ),
    buildAddress(
      body.addresses?.billing,
      "billing",
      session.org_id,
      customerId,
      session.user.id,
      body.addresses?.head_office,
    ),
  ];
  const contactRows = (contactsResult.contacts ?? []).map((contact) => ({
    ...contact,
    customer_id: customerId,
  }));

  const { error: addressError } = await admin
    .from("customer_addresses")
    .insert(addressRows);

  if (addressError) {
    await admin
      .from("customers")
      .update({ record_status: "deleted", updated_by: session.user.id })
      .eq("id", customerId)
      .eq("org_id", session.org_id);

    return jsonError("Unable to save customer addresses", 500);
  }

  if (contactRows.length > 0) {
    const { error: contactsError } = await admin
      .from("customer_contacts")
      .insert(contactRows);

    if (contactsError) {
      await admin
        .from("customers")
        .update({ record_status: "deleted", updated_by: session.user.id })
        .eq("id", customerId)
        .eq("org_id", session.org_id);

      return jsonError("Unable to save customer contacts", 500);
    }
  }

  return NextResponse.json(
    {
      customer: {
        id: customerId,
        customer_code: createdCustomer.customer_code,
        company_name: createdCustomer.company_name,
      },
      message: "Customer created",
    },
    { status: 201 },
  );
}
