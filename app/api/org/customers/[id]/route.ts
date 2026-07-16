import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  email?: string | null;
};

type TagRow = {
  id: string;
  name: string;
  color: string;
};

type CustomerTagRow = {
  customer_id: string;
  tag_id: string;
};

type CustomerNoteRow = {
  author_id?: string | null;
  updated_by?: string | null;
};

type CustomerActivityRow = {
  actor_id?: string | null;
};

type AddressInput = {
  address_line_1?: unknown;
  address_line_2?: unknown;
  city?: unknown;
  province_state?: unknown;
  postal_code?: unknown;
  country?: unknown;
  same_as_head_office?: unknown;
};

type UpdateCustomerBody = {
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
  record_status?: unknown;
  addresses?: {
    head_office?: AddressInput;
    billing?: AddressInput;
  };
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
const recordStatuses = new Set(["draft", "active", "archived", "deleted"]);
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

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  );
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

function buildAddress(
  input: AddressInput | undefined,
  addressType: "head_office" | "billing",
  orgId: string,
  customerId: string,
  userId: string,
  fallback?: AddressInput,
) {
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
    updated_by: userId,
  };
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/customers/[id]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .neq("record_status", "deleted")
    .maybeSingle();

  if (customerError) {
    return jsonError("Unable to fetch customer", 500);
  }

  if (!customer) {
    return jsonError("Customer not found", 404);
  }

  const [
    addressesResult,
    contactsResult,
    notesResult,
    activitiesResult,
    customerTagsResult,
  ] = await Promise.all([
    admin
      .from("customer_addresses")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .neq("status", "deleted")
      .order("address_type", { ascending: true }),
    admin
      .from("customer_contacts")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .neq("status", "deleted")
      .order("is_primary", { ascending: false })
      .order("first_name", { ascending: true }),
    admin
      .from("customer_notes")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .neq("status", "deleted")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("customer_activities")
      .select("*")
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .order("occurred_at", { ascending: false })
      .limit(25),
    admin
      .from("customer_tags")
      .select("customer_id, tag_id")
      .eq("org_id", session.org_id)
      .eq("customer_id", id),
  ]);

  if (addressesResult.error) {
    return jsonError("Unable to fetch customer addresses", 500);
  }

  if (contactsResult.error) {
    return jsonError("Unable to fetch customer contacts", 500);
  }

  if (notesResult.error) {
    return jsonError("Unable to fetch customer notes", 500);
  }

  if (activitiesResult.error) {
    return jsonError("Unable to fetch customer activities", 500);
  }

  if (customerTagsResult.error) {
    return jsonError("Unable to fetch customer tags", 500);
  }

  const tagIds = ((customerTagsResult.data ?? []) as CustomerTagRow[]).map(
    (tag) => tag.tag_id,
  );
  const { data: tags, error: tagsError } =
    tagIds.length > 0
      ? await admin
          .from("tags")
          .select("id, name, color")
          .eq("org_id", session.org_id)
          .in("id", tagIds)
      : { data: [], error: null };

  if (tagsError) {
    return jsonError("Unable to fetch tags", 500);
  }

  const notes = (notesResult.data ?? []) as CustomerNoteRow[];
  const activities = (activitiesResult.data ?? []) as CustomerActivityRow[];
  const profileIds = uniqueStrings([
    customer.assigned_sales_rep_id as string | null,
    customer.account_manager_id as string | null,
    customer.created_by as string | null,
    customer.updated_by as string | null,
    ...notes.flatMap((note) => [note.author_id, note.updated_by]),
    ...activities.map((activity) => activity.actor_id),
  ]);
  const { data: profiles, error: profilesError } =
    profileIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIds)
      : { data: [], error: null };

  if (profilesError) {
    return jsonError("Unable to fetch customer users", 500);
  }

  const profilesById = new Map<string, ProfileRow>();
  for (const profile of (profiles ?? []) as ProfileRow[]) {
    profilesById.set(profile.id, profile);
  }

  const logoStoragePath = customer.logo_storage_path as string | null;
  const { data: signedLogoData } = logoStoragePath
    ? await admin.storage
        .from("crm-assets")
        .createSignedUrl(logoStoragePath, 60 * 60)
    : { data: null };

  return NextResponse.json({
    customer: {
      ...customer,
      logo_signed_url: signedLogoData?.signedUrl ?? null,
      assigned_sales_rep: customer.assigned_sales_rep_id
        ? (profilesById.get(customer.assigned_sales_rep_id as string) ?? null)
        : null,
      account_manager: customer.account_manager_id
        ? (profilesById.get(customer.account_manager_id as string) ?? null)
        : null,
      created_by_profile: customer.created_by
        ? (profilesById.get(customer.created_by as string) ?? null)
        : null,
      updated_by_profile: customer.updated_by
        ? (profilesById.get(customer.updated_by as string) ?? null)
        : null,
    },
    addresses: addressesResult.data ?? [],
    contacts: contactsResult.data ?? [],
    notes: (notesResult.data ?? []).map((note) => ({
      ...note,
      author: note.author_id
        ? (profilesById.get(note.author_id as string) ?? null)
        : null,
    })),
    activities: (activitiesResult.data ?? []).map((activity) => ({
      ...activity,
      actor: activity.actor_id
        ? (profilesById.get(activity.actor_id as string) ?? null)
        : null,
    })),
    tags: (tags ?? []) as TagRow[],
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  let body: UpdateCustomerBody;

  try {
    body = (await request.json()) as UpdateCustomerBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const admin = createAdminClient();
  const { data: existingCustomer, error: existingError } = await admin
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .neq("record_status", "deleted")
    .maybeSingle();

  if (existingError) {
    return jsonError("Unable to validate customer", 500);
  }

  if (!existingCustomer) {
    return jsonError("Customer not found", 404);
  }

  const companyName =
    body.company_name !== undefined ? getString(body.company_name) : undefined;

  if (body.company_name !== undefined && !companyName) {
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
  const recordStatus = getOptionalEnum(
    body.record_status,
    recordStatuses,
    "Record status",
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
    recordStatus,
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

  const assignedSalesRepId =
    body.assigned_sales_rep_id !== undefined
      ? getOptionalString(body.assigned_sales_rep_id)
      : undefined;
  const accountManagerId =
    body.account_manager_id !== undefined
      ? getOptionalString(body.account_manager_id)
      : undefined;
  const assigneeIds = uniqueStrings([assignedSalesRepId, accountManagerId]);

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

  const updates: Record<string, string | number | boolean | null> = {
    updated_by: session.user.id,
  };

  if (body.company_name !== undefined) {
    updates.company_name = companyName!;
  }

  if (body.legal_company_name !== undefined) {
    updates.legal_company_name = getOptionalString(body.legal_company_name);
  }

  if (body.industry !== undefined) {
    updates.industry = getOptionalString(body.industry);
  }

  if (body.business_category !== undefined) {
    updates.business_category = getOptionalString(body.business_category);
  }

  if (body.company_type !== undefined) {
    updates.company_type = companyType.value ?? null;
  }

  if (body.business_registration_number !== undefined) {
    updates.business_registration_number = getOptionalString(
      body.business_registration_number,
    );
  }

  if (body.gst_hst_number !== undefined) {
    updates.gst_hst_number = getOptionalString(body.gst_hst_number);
  }

  if (body.vendor_number !== undefined) {
    updates.vendor_number = getOptionalString(body.vendor_number);
  }

  if (body.assigned_sales_rep_id !== undefined) {
    updates.assigned_sales_rep_id = assignedSalesRepId ?? null;
  }

  if (body.account_manager_id !== undefined) {
    updates.account_manager_id = accountManagerId ?? null;
  }

  if (body.lead_source !== undefined) {
    updates.lead_source = getOptionalString(body.lead_source);
  }

  if (body.referral_source !== undefined) {
    updates.referral_source = getOptionalString(body.referral_source);
  }

  if (body.customer_since !== undefined) {
    updates.customer_since = customerSince.value ?? null;
  }

  if (body.customer_status !== undefined) {
    updates.customer_status = customerStatus.value ?? null;
  }

  if (body.credit_limit !== undefined) {
    updates.credit_limit = creditLimit.value ?? 0;
  }

  if (body.credit_terms !== undefined) {
    updates.credit_terms = selectedCreditTerms.value ?? null;
  }

  if (body.tax_exempt !== undefined) {
    updates.tax_exempt = body.tax_exempt === true;
  }

  if (body.currency !== undefined) {
    updates.currency = currency.value ?? null;
  }

  if (body.preferred_payment_method !== undefined) {
    updates.preferred_payment_method = preferredPaymentMethod.value ?? null;
  }

  if (body.accounts_payable_email !== undefined) {
    updates.accounts_payable_email = getOptionalString(
      body.accounts_payable_email,
    );
  }

  if (body.invoice_email !== undefined) {
    updates.invoice_email = getOptionalString(body.invoice_email);
  }

  if (body.record_status !== undefined) {
    updates.record_status = recordStatus.value ?? null;
  }

  const { data: customer, error: updateError } = await admin
    .from("customers")
    .update(updates)
    .eq("id", id)
    .eq("org_id", session.org_id)
    .select("*")
    .single();

  if (updateError || !customer) {
    return jsonError("Unable to update customer", 500);
  }

  if (body.addresses) {
    const addressRows = [
      buildAddress(
        body.addresses.head_office,
        "head_office",
        session.org_id,
        id,
        session.user.id,
      ),
      buildAddress(
        body.addresses.billing,
        "billing",
        session.org_id,
        id,
        session.user.id,
        body.addresses.head_office,
      ),
    ];

    const { error: addressError } = await admin
      .from("customer_addresses")
      .upsert(addressRows, { onConflict: "customer_id,address_type" });

    if (addressError) {
      return jsonError("Unable to update customer addresses", 500);
    }
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type:
      recordStatus.value === "archived" ? "profile_updated" : "profile_updated",
    description:
      recordStatus.value === "archived"
        ? "Customer profile archived"
        : "Customer profile updated",
    actor_id: session.user.id,
  });

  return NextResponse.json({
    customer,
    message:
      recordStatus.value === "archived"
        ? "Customer archived"
        : "Customer updated",
  });
}
