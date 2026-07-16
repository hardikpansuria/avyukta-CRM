import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type ContactBody = {
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

const allowedRoles = new Set(["admin", "sales", "accountant"]);
const departments = new Set([
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

async function ensureCustomer(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  orgId: string,
) {
  const { data, error } = await admin
    .from("customers")
    .select("id")
    .eq("id", id)
    .eq("org_id", orgId)
    .neq("record_status", "deleted")
    .maybeSingle();

  return { exists: Boolean(data), error };
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/contacts">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  let body: ContactBody;

  try {
    body = (await request.json()) as ContactBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const firstName = getString(body.first_name);

  if (!firstName) {
    return jsonError("First name is required", 400);
  }

  const department = getOptionalString(body.department);

  if (department && !departments.has(department)) {
    return jsonError("Department is invalid", 400);
  }

  const admin = createAdminClient();
  const customerCheck = await ensureCustomer(admin, id, session.org_id);

  if (customerCheck.error) {
    return jsonError("Unable to validate customer", 500);
  }

  if (!customerCheck.exists) {
    return jsonError("Customer not found", 404);
  }

  if (body.is_primary === true) {
    await admin
      .from("customer_contacts")
      .update({ is_primary: false, updated_by: session.user.id })
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .eq("status", "active");
  }

  const { data: contact, error } = await admin
    .from("customer_contacts")
    .insert({
      org_id: session.org_id,
      customer_id: id,
      first_name: firstName,
      last_name: getOptionalString(body.last_name),
      job_title: getOptionalString(body.job_title),
      department,
      email: getOptionalString(body.email),
      mobile_number: getOptionalString(body.mobile_number),
      office_phone: getOptionalString(body.office_phone),
      extension: getOptionalString(body.extension),
      is_primary: body.is_primary === true,
      notes: getOptionalString(body.notes),
      created_by: session.user.id,
    })
    .select("*")
    .single();

  if (error || !contact) {
    return jsonError("Unable to create contact", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "contact_added",
    description: "Contact added",
    actor_id: session.user.id,
    linked_record_type: "customer_contact",
    linked_record_id: contact.id,
  });

  return NextResponse.json({ contact, message: "Contact added" }, { status: 201 });
}
