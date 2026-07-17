import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowedQuotationRoles,
  buildQuotationContactRows,
  getOptionalDate,
  getOptionalString,
  getString,
  listQuotations,
  normalizeContactIds,
  validateCustomer,
  validateCustomerContacts,
  validateSalesRep,
} from "@/lib/quotations/api";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";

  const admin = createAdminClient();
  const result = await listQuotations(admin, session.org_id, {
    search,
    status,
  });

  if (result.error) {
    return jsonError("Unable to fetch quotations", 500);
  }

  return NextResponse.json({
    quotations: result.quotations ?? [],
    filters: { search, status },
  });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (!allowedQuotationRoles.has(session.role)) {
    return jsonError("Forbidden", 403);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const input = body as Record<string, unknown>;
  const customerId = getString(input.customer_id);

  if (!customerId) {
    return jsonError("Customer is required", 400);
  }

  const quoteDate = getOptionalDate(input.quote_date, "Quote date");
  const expiryDate = getOptionalDate(input.expiry_date, "Expiry date");
  const contactIds = normalizeContactIds(input.contact_ids);

  for (const result of [quoteDate, expiryDate, contactIds]) {
    if (result.error) {
      return jsonError(result.error, 400);
    }
  }

  const admin = createAdminClient();
  const customerResult = await validateCustomer(
    admin,
    session.org_id,
    customerId,
  );

  if (customerResult.error) {
    return jsonError("Unable to validate customer", 500);
  }

  if (!customerResult.customer) {
    return jsonError("Customer not found", 404);
  }

  const salesRepId = getOptionalString(input.sales_rep_id);
  const salesRepResult = await validateSalesRep(
    admin,
    session.org_id,
    salesRepId,
  );

  if (salesRepResult.error) {
    return jsonError("Unable to validate sales representative", 500);
  }

  if (!salesRepResult.isValid) {
    return jsonError("Sales representative must be an active user", 400);
  }

  const contactsResult = await validateCustomerContacts(
    admin,
    session.org_id,
    customerId,
    contactIds.value,
  );

  if (contactsResult.error) {
    return jsonError("Unable to validate customer contacts", 500);
  }

  if (contactsResult.invalid) {
    return jsonError("Selected contacts must belong to the customer", 400);
  }

  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .insert({
      org_id: session.org_id,
      customer_id: customerId,
      quote_date: quoteDate.value ?? null,
      expiry_date: expiryDate.value ?? null,
      project_name: getOptionalString(input.project_name),
      project_location: getOptionalString(input.project_location),
      customer_rfq_number: getOptionalString(input.customer_rfq_number),
      prepared_by: session.user.id,
      sales_rep_id: salesRepId,
      status: "draft",
      created_by: session.user.id,
    })
    .select("*")
    .single();

  if (quotationError || !quotation) {
    return jsonError("Unable to create quotation", 500);
  }

  const quotationId = quotation.id as string;
  const contactRows = buildQuotationContactRows(
    session.org_id,
    quotationId,
    contactsResult.contacts ?? [],
  );

  if (contactRows.length > 0) {
    const { error: contactsError } = await admin
      .from("quotation_contacts")
      .insert(contactRows);

    if (contactsError) {
      console.error("Unable to save quotation contacts", {
        code: contactsError.code,
        message: contactsError.message,
      });

      const { error: rollbackError } = await admin
        .from("quotations")
        .delete()
        .eq("id", quotationId)
        .eq("org_id", session.org_id);

      if (rollbackError) {
        console.error("Unable to roll back quotation after contact failure", {
          code: rollbackError.code,
          message: rollbackError.message,
        });
      }

      return jsonError("Unable to save quotation contacts", 500);
    }
  }

  return NextResponse.json(
    {
      quotation,
      message: "Quotation draft created",
    },
    { status: 201 },
  );
}
