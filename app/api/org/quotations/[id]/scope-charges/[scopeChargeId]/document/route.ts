import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { lockedRevisionMessage, logRevisionAudit } from "@/lib/quotations/revisions";

const bucketName = "quotation-documents";
const maxPdfBytes = 10 * 1024 * 1024;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function safePdfFileName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const fileName = normalized || "supporting-document.pdf";

  return fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function hasPdfSignature(bytes: Buffer) {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

async function verifyQuotationCharge(
  quotationId: string,
  scopeChargeId: string,
  orgId: string,
) {
  const admin = createAdminClient();
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("id,is_locked,quotation_series_id,revision_number,org_id")
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quotationError) {
    return { admin, error: "Unable to validate quotation", status: 500 };
  }

  if (!quotation) {
    return { admin, error: "Quotation not found", status: 404 };
  }
  if (quotation.is_locked) {
    return { admin, error: lockedRevisionMessage, status: 409 };
  }

  const { data: charge, error: chargeError } = await admin
    .from("quotation_scope_charges")
    .select("id, scope_id")
    .eq("id", scopeChargeId)
    .eq("quotation_id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (chargeError) {
    return {
      admin,
      error: "Unable to validate additional charge",
      status: 500,
    };
  }

  if (!charge) {
    return { admin, error: "Additional charge not found", status: 404 };
  }

  const { data: scope, error: scopeError } = await admin
    .from("quotation_scopes")
    .select("id")
    .eq("id", charge.scope_id)
    .eq("quotation_id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (scopeError) {
    return { admin, error: "Unable to validate scope", status: 500 };
  }

  if (!scope) {
    return { admin, error: "Scope not found", status: 404 };
  }

  return {
    admin,
    quotation,
    charge: charge as { id: string; scope_id: string },
  };
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/scope-charges/[scopeChargeId]/document">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id, scopeChargeId } = await context.params;
  const validation = await verifyQuotationCharge(
    id,
    scopeChargeId,
    session.org_id,
  );

  if (validation.error || !validation.charge) {
    return jsonError(
      validation.error ?? "Additional charge not found",
      validation.status ?? 404,
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") ?? formData?.get("document");

  if (!(file instanceof File)) {
    return jsonError("Supporting PDF is required", 400);
  }

  if (file.type.toLowerCase() !== "application/pdf") {
    return jsonError("Supporting document must be a PDF", 400);
  }

  if (file.size === 0) {
    return jsonError("Supporting PDF is empty", 400);
  }

  if (file.size > maxPdfBytes) {
    return jsonError("Supporting PDF must be 10 MB or smaller", 400);
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasPdfSignature(bytes)) {
    return jsonError("Supporting document must be a valid PDF", 400);
  }

  const filePath = `${session.org_id}/quotations/${id}/scope-charges/${scopeChargeId}/supporting-document.pdf`;
  const { data: existingDocument, error: existingError } =
    await validation.admin
      .from("quotation_scope_charge_documents")
      .select("id")
      .eq("org_id", session.org_id)
      .eq("quotation_id", id)
      .eq("scope_charge_id", scopeChargeId)
      .maybeSingle();

  if (existingError) {
    return jsonError("Unable to prepare supporting document upload", 500);
  }

  const { error: uploadError } = await validation.admin.storage
    .from(bucketName)
    .upload(filePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return jsonError("Unable to upload supporting document", 500);
  }

  const documentValues = {
    org_id: session.org_id,
    quotation_id: id,
    scope_id: validation.charge.scope_id,
    scope_charge_id: scopeChargeId,
    storage_bucket: bucketName,
    file_name: safePdfFileName(file.name),
    file_path: filePath,
    file_size: file.size,
    mime_type: "application/pdf",
    uploaded_by: session.user.id,
  };
  const documentQuery = existingDocument
    ? validation.admin
        .from("quotation_scope_charge_documents")
        .update(documentValues)
        .eq("id", existingDocument.id)
        .eq("org_id", session.org_id)
        .eq("quotation_id", id)
        .eq("scope_charge_id", scopeChargeId)
    : validation.admin
        .from("quotation_scope_charge_documents")
        .insert(documentValues);
  const { data: document, error: documentError } = await documentQuery
    .select("*")
    .single();

  if (documentError || !document) {
    return jsonError("Unable to save supporting document metadata", 500);
  }

  const { data: signedData } = await validation.admin.storage
    .from(bucketName)
    .createSignedUrl(filePath, 10 * 60);
  await logRevisionAudit(validation.admin, validation.quotation!, session.user.id, "revision_modified", { area: "scope_charge_attachment" });

  return NextResponse.json({
    document: {
      ...document,
      signed_url: signedData?.signedUrl ?? null,
    },
    message: "Supporting document uploaded",
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/scope-charges/[scopeChargeId]/document">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id, scopeChargeId } = await context.params;
  const validation = await verifyQuotationCharge(
    id,
    scopeChargeId,
    session.org_id,
  );

  if (validation.error || !validation.charge) {
    return jsonError(
      validation.error ?? "Additional charge not found",
      validation.status ?? 404,
    );
  }

  const { data: document, error: documentError } = await validation.admin
    .from("quotation_scope_charge_documents")
    .select("*")
    .eq("org_id", session.org_id)
    .eq("quotation_id", id)
    .eq("scope_charge_id", scopeChargeId)
    .maybeSingle();

  if (documentError) {
    return jsonError("Unable to fetch supporting document", 500);
  }

  if (!document) {
    return jsonError("Supporting document not found", 404);
  }

  const { error: removeError } = await validation.admin.storage
    .from(document.storage_bucket || bucketName)
    .remove([document.file_path]);

  if (removeError) {
    return jsonError("Unable to remove supporting document file", 500);
  }

  const { error: deleteError } = await validation.admin
    .from("quotation_scope_charge_documents")
    .delete()
    .eq("org_id", session.org_id)
    .eq("quotation_id", id)
    .eq("scope_charge_id", scopeChargeId);

  if (deleteError) {
    return jsonError("Unable to delete supporting document metadata", 500);
  }

  await logRevisionAudit(validation.admin, validation.quotation!, session.user.id, "revision_modified", { area: "scope_charge_attachment" });

  return NextResponse.json({ message: "Supporting document removed" });
}
