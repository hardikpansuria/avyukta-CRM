import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  getCustomerQuotationData,
  normalizeCustomerQuotationDraft,
  type CustomerQuotationDraftInput,
} from "@/lib/quotations/customer-quotation";
import { createAdminClient } from "@/lib/supabase/admin";

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

async function saveItems({
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
  const { error: deleteError } = await admin
    .from("quotation_customer_document_items")
    .delete()
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId)
    .eq("customer_document_id", customerDocumentId);

  if (deleteError) return { error: deleteError };
  if (items.length === 0) return { error: null };

  return admin.from("quotation_customer_document_items").insert(
    items.map((item) => ({
      org_id: orgId,
      quotation_id: quotationId,
      customer_document_id: customerDocumentId,
      scope_id: item.scope_id,
      sort_order: item.sort_order,
      scope_title_snapshot: item.scope_title_snapshot,
      description_html: item.description_html,
      description_text: item.description_text,
      imported_scope_amount: item.imported_scope_amount,
      estimation_quantity: item.estimation_quantity,
      quantity: item.quantity,
      price_each: item.price_each,
      price_ext: item.price_ext,
    })),
  );
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const admin = createAdminClient();
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

  const itemsResult = await saveItems({
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

  const itemsResult = await saveItems({
    admin,
    orgId: session.org_id,
    quotationId: id,
    customerDocumentId,
    items,
  });

  if (itemsResult.error) {
    return jsonError("Unable to save customer quotation items", 500);
  }

  const saved = await getCustomerQuotationData(admin, session.org_id, id);
  return NextResponse.json(saved.value);
}
