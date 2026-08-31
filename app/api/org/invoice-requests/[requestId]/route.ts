import { NextResponse } from "next/server";

import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { jobDocumentBuckets } from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

const editableTypes = new Set([
  "deposit",
  "progress",
  "final",
  "change_order",
  "credit_note",
]);
const statuses = new Set([
  "pending",
  "under_review",
  "invoice_created",
  "sent_to_customer",
  "paid",
  "archived",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoice_requests", "view");
  if (denied) return denied;
  const { requestId } = await context.params;
  const admin = createAdminClient();
  const { data: invoiceRequest, error } = await admin
    .from("invoice_requests")
    .select("*")
    .eq("id", requestId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to fetch invoice request", 500);
  if (!invoiceRequest) return jsonError("Invoice request not found", 404);

  const [documentsResult, poDocumentsResult, historyResult, requesterResult, invoiceResult] =
    await Promise.all([
      admin
        .from("invoice_request_documents")
        .select("*")
        .eq("invoice_request_id", requestId)
        .eq("org_id", session.org_id)
        .order("uploaded_at", { ascending: false }),
      admin
        .from("job_purchase_order_documents")
        .select("id,file_name,file_path,document_type,uploaded_at")
        .eq("purchase_order_id", invoiceRequest.purchase_order_id)
        .eq("org_id", session.org_id)
        .order("uploaded_at", { ascending: false }),
      admin
        .from("invoice_request_status_history")
        .select("*")
        .eq("invoice_request_id", requestId)
        .eq("org_id", session.org_id)
        .order("changed_at", { ascending: false }),
      invoiceRequest.requested_by
        ? admin
            .from("profiles")
            .select("id,full_name,email")
            .eq("id", invoiceRequest.requested_by)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      invoiceRequest.invoice_id
        ? admin
            .from("job_invoices")
            .select("id,invoice_number,invoice_date,invoice_amount,status")
            .eq("id", invoiceRequest.invoice_id)
            .eq("org_id", session.org_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
  const relationError =
    documentsResult.error ??
    poDocumentsResult.error ??
    historyResult.error ??
    requesterResult.error ??
    invoiceResult.error;
  if (relationError) return jsonError("Unable to load request details", 500);

  const history = historyResult.data ?? [];
  const actorIds = Array.from(new Set(history.map((row) => row.changed_by).filter(Boolean)));
  const { data: actors } = actorIds.length
    ? await admin.from("profiles").select("id,full_name,email").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor]));
  const documents = await Promise.all(
    (documentsResult.data ?? []).map(async (document) => {
      const { data } = await admin.storage
        .from(jobDocumentBuckets.invoiceRequests)
        .createSignedUrl(document.file_path, 900, { download: document.file_name });
      return { ...document, signed_url: data?.signedUrl ?? null };
    }),
  );
  const purchaseOrderDocuments = await Promise.all(
    (poDocumentsResult.data ?? []).map(async (document) => {
      const { data } = await admin.storage
        .from(jobDocumentBuckets.purchaseOrders)
        .createSignedUrl(document.file_path, 900, { download: document.file_name });
      return { ...document, signed_url: data?.signedUrl ?? null };
    }),
  );
  const [canEdit, canProcess, canArchive, canReopen, canDelete, canCreateInvoice] =
    await Promise.all([
      hasOrgPermission(session, "invoice_requests", "edit"),
      hasOrgPermission(session, "invoice_requests", "process"),
      hasOrgPermission(session, "invoice_requests", "archive"),
      hasOrgPermission(session, "invoice_requests", "reopen"),
      hasOrgPermission(session, "invoice_requests", "delete"),
      hasOrgPermission(session, "invoices", "create"),
    ]);
  return NextResponse.json({
    request: {
      ...invoiceRequest,
      requester: requesterResult.data,
      invoice: invoiceResult.data,
      documents,
      purchase_order_documents: purchaseOrderDocuments,
      status_history: history.map((row) => ({
        ...row,
        actor: row.changed_by ? actorMap.get(row.changed_by) ?? null : null,
      })),
    },
    permissions: {
      can_edit:
        canEdit &&
        ((invoiceRequest.status === "pending" &&
          (session.role === "admin" ||
            session.role === "accountant" ||
            invoiceRequest.requested_by === session.user.id)) ||
          (invoiceRequest.status === "under_review" &&
            (session.role === "admin" || session.role === "accountant"))),
      can_process: canProcess,
      can_archive: canArchive,
      can_reopen: canReopen,
      can_delete: canDelete,
      can_create_invoice: canCreateInvoice,
    },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const { requestId } = await context.params;
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("invoice_requests")
    .select("*")
    .eq("id", requestId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate invoice request", 500);
  if (!existing) return jsonError("Invoice request not found", 404);

  const nextStatus = typeof body.status === "string" ? body.status : "";
  const updates: Record<string, unknown> = { updated_by: session.user.id };
  if (nextStatus) {
    if (!statuses.has(nextStatus)) return jsonError("Invalid request status", 400);
    let action: "process" | "archive" | "reopen";
    if (nextStatus === "under_review") action = "process";
    else if (nextStatus === "archived") action = "archive";
    else if (existing.status === "archived" && nextStatus === "pending") action = "reopen";
    else return jsonError("This status is updated from its linked invoice", 409);
    const denied = await requireOrgPermission(session, "invoice_requests", action);
    if (denied) return denied;
    const valid =
      (existing.status === "pending" && nextStatus === "under_review") ||
      (["pending", "under_review"].includes(existing.status) && nextStatus === "archived") ||
      (existing.status === "archived" && nextStatus === "pending");
    if (!valid) return jsonError("Invalid invoice request transition", 409);
    updates.status = nextStatus;
    if (nextStatus === "under_review") updates.accounts_started_at = new Date().toISOString();
    if (nextStatus === "archived") updates.archived_at = new Date().toISOString();
    if (nextStatus === "pending") {
      updates.accounts_started_at = null;
      updates.archived_at = null;
    }
  } else {
    const denied = await requireOrgPermission(session, "invoice_requests", "edit");
    if (denied) return denied;
    const ownerCanEdit =
      (existing.status === "pending" &&
        (session.role === "admin" ||
          session.role === "accountant" ||
          existing.requested_by === session.user.id)) ||
      (existing.status === "under_review" &&
        (session.role === "admin" || session.role === "accountant"));
    if (!ownerCanEdit) return jsonError("Accounts has started processing this request", 409);
    if (typeof body.invoice_type === "string") {
      if (!editableTypes.has(body.invoice_type)) return jsonError("Invalid invoice type", 400);
      updates.invoice_type = body.invoice_type;
    }
    if (typeof body.billing_description === "string") {
      const description = body.billing_description.trim();
      if (!description) return jsonError("Billing description is required", 400);
      updates.billing_description = description;
    }
    if (typeof body.comments_for_accounts === "string") {
      updates.comments_for_accounts = body.comments_for_accounts.trim() || null;
    }
    if (Array.isArray(body.items_to_include)) {
      updates.items_to_include = body.items_to_include.filter((item) => typeof item === "string");
    }
  }

  const { data: updated, error: updateError } = await admin
    .from("invoice_requests")
    .update(updates)
    .eq("id", requestId)
    .eq("org_id", session.org_id)
    .select("*")
    .single();
  if (updateError || !updated) return jsonError("Unable to update invoice request", 500);
  return NextResponse.json({ request: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoice_requests", "delete");
  if (denied) return denied;
  const { requestId } = await context.params;
  const admin = createAdminClient();
  const { data: invoiceRequest } = await admin
    .from("invoice_requests")
    .select("id,invoice_id")
    .eq("id", requestId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (!invoiceRequest) return jsonError("Invoice request not found", 404);
  if (invoiceRequest.invoice_id) return jsonError("Archive requests linked to an invoice", 409);
  const { data: documents } = await admin
    .from("invoice_request_documents")
    .select("file_path")
    .eq("invoice_request_id", requestId)
    .eq("org_id", session.org_id);
  const paths = (documents ?? []).map((document) => document.file_path);
  if (paths.length) await admin.storage.from(jobDocumentBuckets.invoiceRequests).remove(paths);
  await admin.from("invoice_request_status_history").delete().eq("invoice_request_id", requestId).eq("org_id", session.org_id);
  await admin.from("invoice_request_documents").delete().eq("invoice_request_id", requestId).eq("org_id", session.org_id);
  const { error: deleteError } = await admin
    .from("invoice_requests")
    .delete()
    .eq("id", requestId)
    .eq("org_id", session.org_id);
  if (deleteError) return jsonError("Unable to delete invoice request", 500);
  return NextResponse.json({ message: "Invoice request deleted" });
}
