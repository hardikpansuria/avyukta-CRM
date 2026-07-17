import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowedQuotationRoles,
  buildQuotationContactRows,
  getOptionalDate,
  getOptionalStatus,
  getOptionalString,
  getQuotationDetail,
  normalizeContactIds,
  normalizeScopesPayload,
  replaceQuotationScopes,
  validateCustomerContacts,
  validateSalesRep,
} from "@/lib/quotations/api";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const result = await getQuotationDetail(admin, session.org_id, id);

  if (result.error) {
    return jsonError("Unable to fetch quotation", 500);
  }

  if (result.notFound || !result.quotation) {
    return jsonError("Quotation not found", 404);
  }

  return NextResponse.json({
    quotation: result.quotation,
    contacts: result.contacts ?? [],
    scopes: result.scopes ?? [],
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]">,
) {
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

  const { id } = await context.params;
  const input = body as Record<string, unknown>;
  const quoteDate = getOptionalDate(input.quote_date, "Quote date");
  const expiryDate = getOptionalDate(input.expiry_date, "Expiry date");
  const status = getOptionalStatus(input.status);
  const contactIds = normalizeContactIds(input.contact_ids);
  const scopes = normalizeScopesPayload(input.scopes);

  for (const result of [quoteDate, expiryDate, status, contactIds, scopes]) {
    if (result.error) {
      return jsonError(result.error, 400);
    }
  }

  const admin = createAdminClient();
  const { data: existingQuotation, error: existingError } = await admin
    .from("quotations")
    .select("id, customer_id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (existingError) {
    return jsonError("Unable to validate quotation", 500);
  }

  if (!existingQuotation) {
    return jsonError("Quotation not found", 404);
  }

  const customerId = existingQuotation.customer_id as string;
  const salesRepId =
    input.sales_rep_id !== undefined
      ? getOptionalString(input.sales_rep_id)
      : undefined;

  if (salesRepId !== undefined) {
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

  const updates: Record<string, string | number | null> = {
    updated_by: session.user.id,
  };

  if (input.quote_date !== undefined) {
    updates.quote_date = quoteDate.value ?? null;
  }

  if (input.expiry_date !== undefined) {
    updates.expiry_date = expiryDate.value ?? null;
  }

  if (input.project_name !== undefined) {
    updates.project_name = getOptionalString(input.project_name);
  }

  if (input.project_location !== undefined) {
    updates.project_location = getOptionalString(input.project_location);
  }

  if (input.customer_rfq_number !== undefined) {
    updates.customer_rfq_number = getOptionalString(input.customer_rfq_number);
  }

  if (input.sales_rep_id !== undefined) {
    updates.sales_rep_id = salesRepId ?? null;
  }

  if (input.status !== undefined) {
    updates.status = status.value ?? "draft";
  }

  if (scopes.value !== undefined) {
    const scopeResult = await replaceQuotationScopes(
      admin,
      session.org_id,
      id,
      scopes.value,
    );

    if (scopeResult.error) {
      console.error("Unable to replace quotation scopes", {
        code: scopeResult.error.code,
        message: scopeResult.error.message,
      });
      return jsonError("Unable to save quotation scopes", 500);
    }

    updates.material_total = scopeResult.totals.material_total;
    updates.material_profit_total = scopeResult.totals.material_profit_total;
    updates.labour_total = scopeResult.totals.labour_total;
    updates.scope_additional_charges_total =
      scopeResult.totals.scope_additional_charges_total;
    updates.scopes_subtotal = scopeResult.totals.scopes_subtotal;
    updates.scopes_discount_total = scopeResult.totals.scopes_discount_total;
    updates.grand_total_before_tax = scopeResult.totals.grand_total_before_tax;
  }

  const { data: quotation, error: updateError } = await admin
    .from("quotations")
    .update(updates)
    .eq("id", id)
    .eq("org_id", session.org_id)
    .select("*")
    .single();

  if (updateError || !quotation) {
    return jsonError("Unable to update quotation", 500);
  }

  if (contactIds.value !== undefined) {
    const { error: deleteError } = await admin
      .from("quotation_contacts")
      .delete()
      .eq("org_id", session.org_id)
      .eq("quotation_id", id);

    if (deleteError) {
      return jsonError("Unable to update quotation contacts", 500);
    }

    const contactRows = buildQuotationContactRows(
      session.org_id,
      id,
      contactsResult.contacts ?? [],
    );

    if (contactRows.length > 0) {
      const { error: insertError } = await admin
        .from("quotation_contacts")
        .insert(contactRows);

      if (insertError) {
        return jsonError("Unable to update quotation contacts", 500);
      }
    }
  }

  return NextResponse.json({
    quotation,
    message: "Quotation updated",
  });
}
