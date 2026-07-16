import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateContactBody = {
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
  status?: unknown;
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
const statuses = new Set(["active", "archived", "deleted"]);

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

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/customers/[id]/contacts/[contactId]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { id, contactId } = await context.params;
  let body: UpdateContactBody;

  try {
    body = (await request.json()) as UpdateContactBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const updates: Record<string, string | boolean | null> = {
    updated_by: session.user.id,
  };

  if (body.first_name !== undefined) {
    const firstName = getString(body.first_name);

    if (!firstName) {
      return jsonError("First name is required", 400);
    }

    updates.first_name = firstName;
  }

  if (body.last_name !== undefined) {
    updates.last_name = getOptionalString(body.last_name);
  }

  if (body.job_title !== undefined) {
    updates.job_title = getOptionalString(body.job_title);
  }

  if (body.department !== undefined) {
    const department = getOptionalString(body.department);

    if (department && !departments.has(department)) {
      return jsonError("Department is invalid", 400);
    }

    updates.department = department;
  }

  if (body.email !== undefined) {
    updates.email = getOptionalString(body.email);
  }

  if (body.mobile_number !== undefined) {
    updates.mobile_number = getOptionalString(body.mobile_number);
  }

  if (body.office_phone !== undefined) {
    updates.office_phone = getOptionalString(body.office_phone);
  }

  if (body.extension !== undefined) {
    updates.extension = getOptionalString(body.extension);
  }

  if (body.notes !== undefined) {
    updates.notes = getOptionalString(body.notes);
  }

  if (body.status !== undefined) {
    const status = getString(body.status);

    if (!statuses.has(status)) {
      return jsonError("Status is invalid", 400);
    }

    updates.status = status;
    if (status !== "active") {
      updates.is_primary = false;
    }
  }

  if (body.is_primary !== undefined) {
    updates.is_primary = body.is_primary === true;
  }

  if (Object.keys(updates).length === 1) {
    return jsonError("No contact updates provided", 400);
  }

  const admin = createAdminClient();
  const { data: existingContact, error: existingError } = await admin
    .from("customer_contacts")
    .select("id")
    .eq("id", contactId)
    .eq("customer_id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (existingError) {
    return jsonError("Unable to validate contact", 500);
  }

  if (!existingContact) {
    return jsonError("Contact not found", 404);
  }

  if (updates.is_primary === true) {
    await admin
      .from("customer_contacts")
      .update({ is_primary: false, updated_by: session.user.id })
      .eq("org_id", session.org_id)
      .eq("customer_id", id)
      .eq("status", "active");
  }

  const { data: contact, error } = await admin
    .from("customer_contacts")
    .update(updates)
    .eq("id", contactId)
    .eq("customer_id", id)
    .eq("org_id", session.org_id)
    .select("*")
    .single();

  if (error || !contact) {
    return jsonError("Unable to update contact", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: id,
    activity_type: "contact_updated",
    description:
      updates.status === "archived" ? "Contact archived" : "Contact updated",
    actor_id: session.user.id,
    linked_record_type: "customer_contact",
    linked_record_id: contactId,
  });

  return NextResponse.json({ contact, message: "Contact updated" });
}
