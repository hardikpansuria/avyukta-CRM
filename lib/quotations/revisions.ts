import type { SupabaseClient } from "@supabase/supabase-js";

export const lockedRevisionMessage =
  "This quotation revision is locked because it has already been sent.";

type Row = Record<string, unknown>;

function withoutSystemFields(row: Row, additional: string[] = []) {
  const copy = { ...row };
  for (const key of ["id", "created_at", "updated_at", ...additional]) {
    delete copy[key];
  }
  return copy;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function getQuotationLock(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
) {
  return admin
    .from("quotations")
    .select("id,is_locked,status,quotation_series_id,revision_number")
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();
}

export async function logRevisionAudit(
  admin: SupabaseClient,
  quotation: Row,
  actorId: string,
  eventType: string,
  metadata: Row = {},
) {
  const { error } = await admin.from("quotation_revision_audit").insert({
    org_id: quotation.org_id,
    quotation_id: quotation.id,
    quotation_series_id: quotation.quotation_series_id,
    revision_number: Number(quotation.revision_number ?? 0),
    actor_id: actorId,
    event_type: eventType,
    metadata,
  });

  if (error) console.error("Unable to write quotation revision audit", error);
  return { error };
}

export async function synchronizeCustomerQuotation(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
) {
  const [{ data: quotation, error: quotationError }, { data: document, error: documentError }] =
    await Promise.all([
      admin
        .from("quotations")
        .select("id,is_locked")
        .eq("id", quotationId)
        .eq("org_id", orgId)
        .maybeSingle(),
      admin
        .from("quotation_customer_documents")
        .select("id,document_status")
        .eq("quotation_id", quotationId)
        .eq("org_id", orgId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (quotationError || documentError) return { error: quotationError ?? documentError };
  if (!quotation || quotation.is_locked || !document) return { skipped: true };

  const [{ data: scopes, error: scopesError }, { data: items, error: itemsError }] =
    await Promise.all([
      admin
        .from("quotation_scopes")
        .select("id,scope_title,scope_total_after_discount,sort_order")
        .eq("quotation_id", quotationId)
        .eq("org_id", orgId)
        .order("sort_order", { ascending: true }),
      admin
        .from("quotation_customer_document_items")
        .select("*")
        .eq("customer_document_id", document.id)
        .eq("quotation_id", quotationId)
        .eq("org_id", orgId),
    ]);

  if (scopesError || itemsError) return { error: scopesError ?? itemsError };
  const itemsByScope = new Map((items ?? []).map((item) => [item.scope_id as string, item]));
  const nextScopeIds = new Set((scopes ?? []).map((scope) => scope.id as string));
  const removedIds = (items ?? [])
    .filter((item) => !nextScopeIds.has(item.scope_id as string))
    .map((item) => item.id as string);

  if (removedIds.length) {
    const { error } = await admin
      .from("quotation_customer_document_items")
      .delete()
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .in("id", removedIds);
    if (error) return { error };
  }

  for (const [index, scope] of (scopes ?? []).entries()) {
    const current = itemsByScope.get(scope.id as string);
    const amount = Number(scope.scope_total_after_discount ?? 0);
    const estimationQuantity = Number(current?.estimation_quantity ?? 0);
    const quantity = Number(current?.quantity ?? 1) || 1;
    const priceEach = estimationQuantity > 0 ? amount / estimationQuantity : 0;
    const values = {
      scope_title_snapshot: scope.scope_title,
      imported_scope_amount: amount,
      sort_order: index + 1,
      price_each: priceEach,
      price_ext: priceEach * quantity,
    };

    const result = current
      ? await admin
          .from("quotation_customer_document_items")
          .update(values)
          .eq("id", current.id)
          .eq("org_id", orgId)
          .eq("quotation_id", quotationId)
      : await admin.from("quotation_customer_document_items").insert({
          id: crypto.randomUUID(),
          org_id: orgId,
          quotation_id: quotationId,
          customer_document_id: document.id,
          scope_id: scope.id,
          ...values,
          description_html: escapeHtml(scope.scope_title),
          description_text: String(scope.scope_title ?? ""),
          estimation_quantity: null,
          quantity: 1,
        });
    if (result.error) return { error: result.error };
  }

  const { data: totals, error: totalsError } = await admin
    .from("quotation_customer_document_items")
    .select("price_ext")
    .eq("customer_document_id", document.id)
    .eq("org_id", orgId);
  if (totalsError) return { error: totalsError };
  const total = (totals ?? []).reduce((sum, item) => sum + Number(item.price_ext ?? 0), 0);
  const { error } = await admin
    .from("quotation_customer_documents")
    .update({
      document_status: "draft",
      subtotal: total,
      total,
      generated_pdf_storage_path: null,
      generated_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", document.id)
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId);
  return error ? { error } : { synchronized: true };
}

async function fetchRows(admin: SupabaseClient, table: string, orgId: string, quotationId: string) {
  return admin.from(table).select("*").eq("org_id", orgId).eq("quotation_id", quotationId);
}

function rpcId(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return rpcId(data[0]);
  if (data && typeof data === "object") {
    const row = data as Row;
    for (const key of ["id", "quotation_id", "new_quotation_id", "create_quotation_revision"]) {
      if (typeof row[key] === "string") return row[key] as string;
    }
  }
  return null;
}

export function revisionIdFromRpc(data: unknown) {
  return rpcId(data);
}

export async function cloneQuotationRevisionData(
  admin: SupabaseClient,
  orgId: string,
  sourceQuotationId: string,
  newQuotationId: string,
  actorId: string,
) {
  const tables = [
    "quotation_contacts",
    "quotation_scopes",
    "quotation_material_items",
    "quotation_labour_items",
    "quotation_scope_charges",
    "quotation_final_adjustments",
    "quotation_note_sections",
    "quotation_material_documents",
    "quotation_scope_charge_documents",
    "quotation_customer_documents",
    "quotation_customer_document_items",
  ];
  const results = await Promise.all(
    tables.map((table) => fetchRows(admin, table, orgId, sourceQuotationId)),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;
  const data = new Map(tables.map((table, index) => [table, (results[index].data ?? []) as Row[]]));
  const scopeMap = new Map<string, string>();
  const materialMap = new Map<string, string>();
  const chargeMap = new Map<string, string>();
  const uploaded: Array<{ bucket: string; path: string }> = [];

  try {
    const insertRows = async (table: string, rows: Row[]) => {
      if (!rows.length) return;
      const { error } = await admin.from(table).insert(rows);
      if (error) throw error;
    };

    await insertRows(
      "quotation_contacts",
      data.get("quotation_contacts")!.map((row) => ({
        ...withoutSystemFields(row), id: crypto.randomUUID(), org_id: orgId, quotation_id: newQuotationId,
      })),
    );

    const scopes = data.get("quotation_scopes")!.map((row) => {
      const id = crypto.randomUUID();
      scopeMap.set(String(row.id), id);
      return { ...withoutSystemFields(row), id, org_id: orgId, quotation_id: newQuotationId };
    });
    await insertRows("quotation_scopes", scopes);

    const materials = data.get("quotation_material_items")!.map((row) => {
      const id = crypto.randomUUID();
      materialMap.set(String(row.id), id);
      return { ...withoutSystemFields(row), id, org_id: orgId, quotation_id: newQuotationId, scope_id: scopeMap.get(String(row.scope_id)) };
    });
    await insertRows("quotation_material_items", materials);

    await insertRows("quotation_labour_items", data.get("quotation_labour_items")!.map((row) => ({
      ...withoutSystemFields(row), id: crypto.randomUUID(), org_id: orgId, quotation_id: newQuotationId, scope_id: scopeMap.get(String(row.scope_id)),
    })));

    const charges = data.get("quotation_scope_charges")!.map((row) => {
      const id = crypto.randomUUID();
      chargeMap.set(String(row.id), id);
      return { ...withoutSystemFields(row), id, org_id: orgId, quotation_id: newQuotationId, scope_id: scopeMap.get(String(row.scope_id)) };
    });
    await insertRows("quotation_scope_charges", charges);

    for (const table of ["quotation_final_adjustments", "quotation_note_sections"]) {
      await insertRows(table, data.get(table)!.map((row) => ({
        ...withoutSystemFields(row), id: crypto.randomUUID(), org_id: orgId, quotation_id: newQuotationId,
      })));
    }

    const cloneFile = async (row: Row, path: string) => {
      const bucket = String(row.storage_bucket || "quotation-documents");
      const { data: blob, error: downloadError } = await admin.storage.from(bucket).download(String(row.file_path));
      if (downloadError || !blob) throw downloadError ?? new Error("Attachment download failed");
      const { error: uploadError } = await admin.storage.from(bucket).upload(path, await blob.arrayBuffer(), {
        contentType: String(row.mime_type || "application/pdf"), upsert: false,
      });
      if (uploadError) throw uploadError;
      uploaded.push({ bucket, path });
      return { bucket, size: blob.size };
    };

    for (const row of data.get("quotation_material_documents")!) {
      const materialId = materialMap.get(String(row.material_item_id));
      const scopeId = scopeMap.get(String(row.scope_id));
      if (!materialId || !scopeId) throw new Error("Unable to map material attachment");
      const path = `${orgId}/quotations/${newQuotationId}/materials/${materialId}/supplier-quote.pdf`;
      const file = await cloneFile(row, path);
      await insertRows("quotation_material_documents", [{
        ...withoutSystemFields(row, ["file_path", "uploaded_by"]), id: crypto.randomUUID(), org_id: orgId,
        quotation_id: newQuotationId, scope_id: scopeId, material_item_id: materialId,
        storage_bucket: file.bucket, file_path: path, file_size: file.size, uploaded_by: actorId,
      }]);
    }

    for (const row of data.get("quotation_scope_charge_documents")!) {
      const chargeId = chargeMap.get(String(row.scope_charge_id));
      const scopeId = scopeMap.get(String(row.scope_id));
      if (!chargeId || !scopeId) throw new Error("Unable to map charge attachment");
      const path = `${orgId}/quotations/${newQuotationId}/scope-charges/${chargeId}/supporting-document.pdf`;
      const file = await cloneFile(row, path);
      await insertRows("quotation_scope_charge_documents", [{
        ...withoutSystemFields(row, ["file_path", "uploaded_by"]), id: crypto.randomUUID(), org_id: orgId,
        quotation_id: newQuotationId, scope_id: scopeId, scope_charge_id: chargeId,
        storage_bucket: file.bucket, file_path: path, file_size: file.size, uploaded_by: actorId,
      }]);
    }

    const sourceDocuments = data.get("quotation_customer_documents")!;
    if (sourceDocuments.length) {
      const sourceDocument = [...sourceDocuments].sort((a, b) => String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0];
      const { data: nextQuotation, error: nextError } = await admin
        .from("quotations").select("revision_number,quotation_number").eq("id", newQuotationId).eq("org_id", orgId).single();
      if (nextError) throw nextError;
      const customerDocumentId = crypto.randomUUID();
      await insertRows("quotation_customer_documents", [{
        ...withoutSystemFields(sourceDocument, ["generated_pdf_storage_path", "generated_at", "created_by", "updated_by"]),
        id: customerDocumentId, org_id: orgId, quotation_id: newQuotationId,
        quotation_number_snapshot: nextQuotation.quotation_number,
        revision_number_snapshot: nextQuotation.revision_number,
        document_status: "draft", generated_pdf_storage_path: null, generated_at: null,
        created_by: actorId, updated_by: actorId,
      }]);
      const sourceItems = data.get("quotation_customer_document_items")!.filter((row) => row.customer_document_id === sourceDocument.id);
      const scopeTotals = new Map(scopes.map((scope) => [scope.id as string, Number((scope as Row).scope_total_after_discount ?? 0)]));
      await insertRows("quotation_customer_document_items", sourceItems.map((row) => {
        const scopeId = scopeMap.get(String(row.scope_id));
        const amount = scopeId ? (scopeTotals.get(scopeId) ?? 0) : 0;
        const estimation = Number(row.estimation_quantity ?? 0);
        const quantity = Number(row.quantity ?? 1) || 1;
        const priceEach = estimation > 0 ? amount / estimation : 0;
        return {
          ...withoutSystemFields(row), id: crypto.randomUUID(), org_id: orgId, quotation_id: newQuotationId,
          customer_document_id: customerDocumentId, scope_id: scopeId,
          imported_scope_amount: amount, price_each: priceEach, price_ext: priceEach * quantity,
        };
      }));
    }
  } catch (error) {
    await Promise.all(uploaded.map((file) => admin.storage.from(file.bucket).remove([file.path])));
    await admin.from("quotations").delete().eq("id", newQuotationId).eq("org_id", orgId);
    throw error;
  }
}
