import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  getCustomerQuotationData,
  normalizeCustomerQuotationDraft,
  type CustomerQuotationDraftInput,
} from "@/lib/quotations/customer-quotation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQuotationLock, lockedRevisionMessage, logRevisionAudit } from "@/lib/quotations/revisions";
import { syncCustomerQuotationPricing } from "@/lib/quotations/sync-customer-quotation-pricing";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function parseBody(request: Request) {
  try {
    return (await request.json()) as CustomerQuotationDraftInput;
  } catch {
    return null;
  }
}

function itemsBelongToQuotation(
  items: Array<Record<string, unknown>>,
  sourceScopes: Array<{ id: unknown }>,
) {
  const scopeIds = new Set(sourceScopes.map((scope) => String(scope.id)));
  const submittedScopeIds = items.map((item) => String(item.scope_id ?? ""));

  return (
    submittedScopeIds.every((scopeId) => scopeIds.has(scopeId)) &&
    new Set(submittedScopeIds).size === submittedScopeIds.length
  );
}

async function saveDescriptions({
  admin,
  orgId,
  quotationId,
  customerDocumentId,
  items,
}: {
  admin: ReturnType<typeof createAdminClient>;
  orgId: string;
  quotationId: string;
  customerDocumentId: string;
  items: Array<Record<string, unknown>>;
}) {
  for (const item of items) {
    const { error } = await admin
      .from("quotation_customer_document_items")
      .update({
        description_html: item.description_html,
        description_text: item.description_text,
      })
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .eq("customer_document_id", customerDocumentId)
      .eq("scope_id", item.scope_id);
    if (error) return { error };
  }
  return { error: null };
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: lock } = await getQuotationLock(admin, session.org_id, id);
  if (lock && !lock.is_locked) {
    const syncResult = await syncCustomerQuotationPricing({
      orgId: session.org_id,
      quotationId: id,
      actorId: session.user.id,
      adminClient: admin,
    });
    if (syncResult.error) {
      return jsonError("Unable to synchronize customer quotation pricing", 500);
    }
  }
  const result = await getCustomerQuotationData(admin, session.org_id, id);

  if (result.notFound) return jsonError("Quotation not found", 404);
  if (result.error || !result.value) {
    return jsonError("Unable to fetch customer quotation", 500);
  }

  return NextResponse.json(result.value);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody(request);
  if (!body) return jsonError("Invalid request body", 400);

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: lock } = await getQuotationLock(admin, session.org_id, id);
  if (lock?.is_locked) return jsonError(lockedRevisionMessage, 409);
  const sourceResult = await getCustomerQuotationData(
    admin,
    session.org_id,
    id,
  );

  if (sourceResult.notFound) return jsonError("Quotation not found", 404);
  if (sourceResult.error || !sourceResult.value) {
    return jsonError("Unable to prepare customer quotation", 500);
  }

  if (sourceResult.value.exists) {
    return jsonError("Customer quotation draft already exists", 409);
  }

  const normalized = normalizeCustomerQuotationDraft(
    body,
    sourceResult.value.document,
  );

  if (normalized.error || !normalized.value) {
    return jsonError(normalized.error ?? "Invalid customer quotation", 400);
  }

  const fallback = sourceResult.value.document as Record<string, unknown>;
  const pricingSummary = sourceResult.value.pricing_summary;
  const { items, ...draft } = normalized.value;
  if (
    !itemsBelongToQuotation(items, sourceResult.value.source_scopes)
  ) {
    return jsonError("Customer quotation contains an invalid scope", 400);
  }

  const { data: document, error: documentError } = await admin
    .from("quotation_customer_documents")
    .insert({
      org_id: session.org_id,
      quotation_id: id,
      document_status: "draft",
      ...draft,
      quotation_number_snapshot: fallback.quotation_number_snapshot,
      revision_number_snapshot: fallback.revision_number_snapshot,
      prepared_by_id: fallback.prepared_by_id,
      prepared_by_name_snapshot: fallback.prepared_by_name_snapshot,
      subtotal: Number(pricingSummary.subtotal ?? 0),
      discount_amount: Number(pricingSummary.discount_amount ?? 0),
      tax_name_snapshot: pricingSummary.tax_name,
      tax_rate_snapshot: Number(pricingSummary.tax_rate ?? 0),
      tax_amount: Number(pricingSummary.tax_amount ?? 0),
      total: Number(pricingSummary.total ?? 0),
      pricing_synced_at: new Date().toISOString(),
      generated_pdf_storage_path: null,
      generated_at: null,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("*")
    .single();

  if (documentError || !document) {
    return jsonError("Unable to create customer quotation draft", 500);
  }

  const syncResult = await syncCustomerQuotationPricing({
    orgId: session.org_id,
    quotationId: id,
    actorId: session.user.id,
    adminClient: admin,
  });
  if (syncResult.error) {
    return jsonError("Unable to synchronize customer quotation pricing", 500);
  }

  const itemsResult = await saveDescriptions({
    admin,
    orgId: session.org_id,
    quotationId: id,
    customerDocumentId: document.id,
    items,
  });

  if (itemsResult.error) {
    return jsonError("Unable to save customer quotation items", 500);
  }

  const saved = await getCustomerQuotationData(admin, session.org_id, id);
  await logRevisionAudit(admin, { ...lock, id, org_id: session.org_id }, session.user.id, "revision_modified", { area: "customer_quotation" });
  return NextResponse.json(saved.value, { status: 201 });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);

  const body = await parseBody(request);
  if (!body) return jsonError("Invalid request body", 400);

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: lock } = await getQuotationLock(admin, session.org_id, id);
  if (lock?.is_locked) return jsonError(lockedRevisionMessage, 409);
  const sourceResult = await getCustomerQuotationData(
    admin,
    session.org_id,
    id,
  );

  if (sourceResult.notFound) return jsonError("Quotation not found", 404);
  if (sourceResult.error || !sourceResult.value) {
    return jsonError("Unable to prepare customer quotation", 500);
  }

  if (!sourceResult.value.exists) {
    return jsonError("Customer quotation draft not found", 404);
  }

  const normalized = normalizeCustomerQuotationDraft(
    body,
    sourceResult.value.document,
  );

  if (normalized.error || !normalized.value) {
    return jsonError(normalized.error ?? "Invalid customer quotation", 400);
  }

  const customerDocumentId = String(sourceResult.value.document.id);
  const { items, ...draft } = normalized.value;
  if (
    !itemsBelongToQuotation(items, sourceResult.value.source_scopes)
  ) {
    return jsonError("Customer quotation contains an invalid scope", 400);
  }

  const { error: updateError } = await admin
    .from("quotation_customer_documents")
    .update({
      ...draft,
      document_status: "draft",
      updated_by: session.user.id,
    })
    .eq("id", customerDocumentId)
    .eq("org_id", session.org_id)
    .eq("quotation_id", id);

  if (updateError) {
    return jsonError("Unable to update customer quotation draft", 500);
  }

  const itemsResult = await saveDescriptions({
    admin,
    orgId: session.org_id,
    quotationId: id,
    customerDocumentId,
    items,
  });

  if (itemsResult.error) {
    return jsonError("Unable to save customer quotation items", 500);
  }

  const syncResult = await syncCustomerQuotationPricing({
    orgId: session.org_id,
    quotationId: id,
    actorId: session.user.id,
    adminClient: admin,
  });
  if (syncResult.error) {
    return jsonError("Unable to synchronize customer quotation pricing", 500);
  }

  const saved = await getCustomerQuotationData(admin, session.org_id, id);
  await logRevisionAudit(admin, { ...lock, id, org_id: session.org_id }, session.user.id, "revision_modified", { area: "customer_quotation" });
  return NextResponse.json(saved.value);
}
