import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  allowedQuotationRoles,
  buildQuotationContactRows,
  calculateFinalQuotationTotals,
  getOptionalDate,
  getOptionalStatus,
  getOptionalString,
  getQuotationDetail,
  normalizeContactIds,
  normalizeFinalAdjustmentsPayload,
  normalizeNoteSectionsPayload,
  normalizeScopesPayload,
  replaceFinalAdjustments,
  replaceNoteSections,
  replaceQuotationScopes,
  validateCustomerContacts,
  validateSalesRep,
} from "@/lib/quotations/api";
import type { FinalAdjustmentInput } from "@/lib/quotations/scope-calculations";
import {
  lockedRevisionMessage,
  logRevisionAudit,
  synchronizeCustomerQuotation,
} from "@/lib/quotations/revisions";

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

  const seriesId = (result.quotation as Record<string, unknown>).quotation_series_id as string | null;
  const { data: seriesRevisions } = seriesId
    ? await admin
        .from("quotations")
        .select("id,quotation_number,revision_number,revision_purpose,revision_source_id,revision_created_by,revision_created_at,status,is_locked,created_at,updated_at,customer_id")
        .eq("org_id", session.org_id)
        .eq("quotation_series_id", seriesId)
        .order("revision_number", { ascending: true })
    : { data: [] };
  const revisionCreatorIds = Array.from(new Set((seriesRevisions ?? []).map((row) => row.revision_created_by as string).filter(Boolean)));
  const { data: revisionProfiles } = revisionCreatorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", revisionCreatorIds)
    : { data: [] };
  const revisionProfilesById = new Map((revisionProfiles ?? []).map((profile) => [profile.id, profile]));
  const { data: auditRows } = session.role === "admin" && seriesId
    ? await admin
        .from("quotation_revision_audit")
        .select("*")
        .eq("org_id", session.org_id)
        .eq("quotation_series_id", seriesId)
        .order("created_at", { ascending: false })
    : { data: [] };
  const auditActorIds = Array.from(new Set((auditRows ?? []).map((row) => row.actor_id as string).filter(Boolean)));
  const { data: auditProfiles } = auditActorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", auditActorIds)
    : { data: [] };
  const auditProfilesById = new Map((auditProfiles ?? []).map((profile) => [profile.id, profile]));

  return NextResponse.json({
    quotation: result.quotation,
    contacts: result.contacts ?? [],
    scopes: result.scopes ?? [],
    final_adjustments: result.final_adjustments ?? [],
    note_sections: result.note_sections ?? [],
    status_history: result.status_history ?? [],
    revisions: result.revisions ?? [],
    series_revisions: (seriesRevisions ?? []).map((revision) => ({
      ...revision,
      created_by_profile: revisionProfilesById.get(revision.revision_created_by as string) ?? null,
    })),
    revision_audit: (auditRows ?? []).map((event) => ({
      ...event,
      actor_profile: auditProfilesById.get(event.actor_id as string) ?? null,
    })),
    tax_warning: result.tax_warning ?? null,
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
  const finalAdjustments = normalizeFinalAdjustmentsPayload(
    input.final_adjustments,
  );
  const noteSections = normalizeNoteSectionsPayload(input.note_sections);

  for (const result of [
    quoteDate,
    expiryDate,
    status,
    contactIds,
    scopes,
    finalAdjustments,
    noteSections,
  ]) {
    if (result.error) {
      return jsonError(result.error, 400);
    }
  }

  const admin = createAdminClient();
  const { data: existingQuotation, error: existingError } = await admin
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (existingError) {
    return jsonError("Unable to validate quotation", 500);
  }

  if (!existingQuotation) {
    return jsonError("Quotation not found", 404);
  }

  if (existingQuotation.is_locked === true) {
    return jsonError(lockedRevisionMessage, 409);
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

  const updates: Record<string, string | number | boolean | null> = {
    updated_by: session.user.id,
  };
  let scopeTotals = {
    material_total: Number(existingQuotation.material_total ?? 0),
    material_profit_total: Number(existingQuotation.material_profit_total ?? 0),
    labour_total: Number(existingQuotation.labour_total ?? 0),
    scope_additional_charges_total: Number(
      existingQuotation.scope_additional_charges_total ?? 0,
    ),
    scopes_subtotal: Number(existingQuotation.scopes_subtotal ?? 0),
    scopes_discount_total: Number(existingQuotation.scopes_discount_total ?? 0),
    grand_total_before_tax: Number(
      existingQuotation.scopes_subtotal ??
        existingQuotation.grand_total_before_tax ??
        0,
    ),
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
    scopeTotals = scopeResult.totals;
  }

  const finalDiscountType =
    input.final_discount_type !== undefined
      ? getOptionalString(input.final_discount_type) ?? "none"
      : ((existingQuotation.final_discount_type as string | null) ?? "none");
  const finalDiscountValue =
    input.final_discount_value !== undefined
      ? (input.final_discount_value as string | number | null)
      : ((existingQuotation.final_discount_value as string | number | null) ??
        0);
  let adjustmentsForCalculation: FinalAdjustmentInput[] =
    finalAdjustments.value ?? [];

  if (finalAdjustments.value !== undefined) {
    const adjustmentResult = await replaceFinalAdjustments(
      admin,
      session.org_id,
      id,
      finalAdjustments.value,
      scopeTotals.grand_total_before_tax,
    );

    if (adjustmentResult.error) {
      return jsonError("Unable to save final adjustments", 500);
    }
  } else {
    const { data: existingAdjustments, error: adjustmentsError } = await admin
      .from("quotation_final_adjustments")
      .select("description, calculation_type, value")
      .eq("org_id", session.org_id)
      .eq("quotation_id", id);

    if (adjustmentsError) {
      return jsonError("Unable to fetch final adjustments", 500);
    }

    adjustmentsForCalculation = (existingAdjustments ??
      []) as FinalAdjustmentInput[];
  }

  if (noteSections.value !== undefined) {
    const notesResult = await replaceNoteSections(
      admin,
      session.org_id,
      id,
      noteSections.value,
    );

    if (notesResult.error) {
      return jsonError("Unable to save note sections", 500);
    }
  }

  const finalTotalsResult = await calculateFinalQuotationTotals(
    admin,
    session.org_id,
    id,
    customerId,
    scopeTotals,
    finalDiscountType,
    finalDiscountValue,
    adjustmentsForCalculation,
  );
  updates.final_discount_type = finalTotalsResult.totals.final_discount_type;
  updates.final_discount_value = finalTotalsResult.totals.final_discount_value;
  updates.final_discount_amount = finalTotalsResult.totals.final_discount_amount;
  updates.final_additional_charges_total =
    finalTotalsResult.totals.final_additional_charges_total;
  updates.grand_total_before_tax = finalTotalsResult.totals.grand_total_before_tax;
  updates.is_tax_exempt = finalTotalsResult.taxInfo.taxExempt;
  updates.tax_name = finalTotalsResult.taxInfo.taxName;
  updates.tax_rate = finalTotalsResult.totals.tax_rate;
  updates.tax_amount = finalTotalsResult.totals.tax_amount;
  updates.grand_total_after_tax = finalTotalsResult.totals.grand_total_after_tax;

  if (contactIds.value !== undefined) {
    const { error: deleteError } = await admin
      .from("quotation_contacts")
      .delete()
      .eq("org_id", session.org_id)
      .eq("quotation_id", id);

    if (deleteError) return jsonError("Unable to update quotation contacts", 500);
    const contactRows = buildQuotationContactRows(session.org_id, id, contactsResult.contacts ?? []);
    if (contactRows.length > 0) {
      const { error: insertError } = await admin.from("quotation_contacts").insert(contactRows);
      if (insertError) return jsonError("Unable to update quotation contacts", 500);
    }
  }

  const syncResult = await synchronizeCustomerQuotation(admin, session.org_id, id);
  if (syncResult.error) {
    console.error("Unable to synchronize customer quotation", syncResult.error);
    return jsonError("Unable to synchronize the customer quotation draft", 500);
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

  const areas = [
    scopes.value !== undefined && "scope/material/labour/scope_charge",
    finalAdjustments.value !== undefined && "final_adjustment",
    noteSections.value !== undefined && "notes",
    contactIds.value !== undefined && "contacts",
    "quotation",
  ].filter(Boolean);
  await logRevisionAudit(admin, quotation, session.user.id, "revision_modified", { area: areas.join(",") });

  if (
    input.status !== undefined &&
    status.value &&
    status.value !== existingQuotation.status
  ) {
    if (status.value === "sent") {
      await logCustomerActivity(admin, {
        org_id: session.org_id,
        customer_id: customerId,
        activity_type: "quote_sent",
        description: `Quotation ${quotation.quotation_number} sent`,
        actor_id: session.user.id,
        linked_record_type: "quotation",
        linked_record_id: id,
        linked_record_number: quotation.quotation_number,
      });
    }
    await logRevisionAudit(admin, quotation, session.user.id, "status_changed", {
      previous_status: existingQuotation.status,
      new_status: status.value,
    });
  }

  return NextResponse.json({
    quotation,
    message: "Quotation updated",
  });
}
