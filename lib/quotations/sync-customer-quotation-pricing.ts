import type { SupabaseClient } from "@supabase/supabase-js";

type SyncInput = {
  orgId: string;
  quotationId: string;
  actorId: string;
  adminClient: SupabaseClient;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function syncCustomerQuotationPricing({
  orgId,
  quotationId,
  actorId,
  adminClient,
}: SyncInput) {
  const { data: quotation, error: quotationError } = await adminClient
    .from("quotations")
    .select(
      "id,is_locked,final_discount_amount,final_additional_charges_total,grand_total_before_tax,tax_name,tax_rate,tax_amount,grand_total_after_tax",
    )
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quotationError) return { error: quotationError };
  if (!quotation) return { notFound: true };
  if (quotation.is_locked) {
    return {
      locked: true,
      error: new Error(
        "This quotation revision is locked because it has already been sent.",
      ),
    };
  }

  const { data: document, error: documentError } = await adminClient
    .from("quotation_customer_documents")
    .select("id")
    .eq("quotation_id", quotationId)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) return { error: documentError };
  if (!document) return { skipped: true };

  const [{ data: scopes, error: scopesError }, { data: items, error: itemsError }] =
    await Promise.all([
      adminClient
        .from("quotation_scopes")
        .select("id,scope_title,scope_total_after_discount,quantity,sort_order")
        .eq("quotation_id", quotationId)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true }),
      adminClient
        .from("quotation_customer_document_items")
        .select("*")
        .eq("customer_document_id", document.id)
        .eq("quotation_id", quotationId)
        .eq("org_id", orgId),
    ]);

  if (scopesError || itemsError) return { error: scopesError ?? itemsError };

  const itemsByScope = new Map(
    (items ?? []).map((item) => [item.scope_id as string, item]),
  );
  const activeScopeIds = new Set((scopes ?? []).map((scope) => scope.id as string));
  const removedItemIds = (items ?? [])
    .filter((item) => !activeScopeIds.has(item.scope_id as string))
    .map((item) => item.id as string);

  if (removedItemIds.length > 0) {
    const { error } = await adminClient
      .from("quotation_customer_document_items")
      .delete()
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .eq("customer_document_id", document.id)
      .in("id", removedItemIds);
    if (error) return { error };
  }

  for (const [index, scope] of (scopes ?? []).entries()) {
    const existing = itemsByScope.get(scope.id as string);
    const sourceScopeTotal = roundMoney(Number(scope.scope_total_after_discount ?? 0));
    const sourceQuantity = Number(scope.quantity ?? 1);

    if (!Number.isFinite(sourceQuantity) || sourceQuantity <= 0) {
      return { error: new Error(`Scope ${scope.id} has an invalid quantity.`) };
    }

    const priceEach = roundMoney(sourceScopeTotal / sourceQuantity);
    const priceExt = roundMoney(priceEach * sourceQuantity);
    const pricing = {
      sort_order: index + 1,
      scope_title_snapshot: scope.scope_title,
      imported_scope_amount: sourceScopeTotal,
      estimation_quantity: sourceQuantity,
      quantity: sourceQuantity,
      price_each: priceEach,
      price_ext: priceExt,
    };
    const result = existing
      ? await adminClient
          .from("quotation_customer_document_items")
          .update(pricing)
          .eq("id", existing.id)
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
          .eq("customer_document_id", document.id)
      : await adminClient.from("quotation_customer_document_items").insert({
          id: crypto.randomUUID(),
          org_id: orgId,
          quotation_id: quotationId,
          customer_document_id: document.id,
          scope_id: scope.id,
          description_html: escapeHtml(scope.scope_title),
          description_text: String(scope.scope_title ?? ""),
          ...pricing,
        });

    if (result.error) return { error: result.error };
  }

  const { data: synchronizedItems, error: synchronizedItemsError } =
    await adminClient
      .from("quotation_customer_document_items")
      .select("price_ext")
      .eq("customer_document_id", document.id)
      .eq("quotation_id", quotationId)
      .eq("org_id", orgId);

  if (synchronizedItemsError) return { error: synchronizedItemsError };
  const subtotal = roundMoney(
    (synchronizedItems ?? []).reduce(
      (sum, item) => sum + Number(item.price_ext ?? 0),
      0,
    ),
  );
  const syncedAt = new Date().toISOString();
  const { error: summaryError } = await adminClient
    .from("quotation_customer_documents")
    .update({
      document_status: "draft",
      subtotal,
      discount_amount: Number(quotation.final_discount_amount ?? 0),
      tax_name_snapshot: quotation.tax_name,
      tax_rate_snapshot: Number(quotation.tax_rate ?? 0),
      tax_amount: Number(quotation.tax_amount ?? 0),
      total: Number(quotation.grand_total_after_tax ?? 0),
      pricing_synced_at: syncedAt,
      generated_pdf_storage_path: null,
      generated_at: null,
      updated_by: actorId,
      updated_at: syncedAt,
    })
    .eq("id", document.id)
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);

  return summaryError
    ? { error: summaryError }
    : {
        synchronized: true,
        documentId: document.id,
        summary: {
          subtotal,
          discount_amount: Number(quotation.final_discount_amount ?? 0),
          final_additional_charges_total: Number(
            quotation.final_additional_charges_total ?? 0,
          ),
          grand_total_before_tax: Number(quotation.grand_total_before_tax ?? 0),
          tax_name: quotation.tax_name,
          tax_rate: Number(quotation.tax_rate ?? 0),
          tax_amount: Number(quotation.tax_amount ?? 0),
          total: Number(quotation.grand_total_after_tax ?? 0),
        },
      };
}
