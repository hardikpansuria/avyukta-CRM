import { Buffer } from "node:buffer";

import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

const bucketName = "quotation-documents";
const maxPdfBytes = 10 * 1024 * 1024;
const pdfMimeTypes = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
  "",
]);

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

  const fileName = normalized || "supplier-quote.pdf";

  return fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
}

function hasPdfSignature(bytes: Buffer) {
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

async function verifyQuotationMaterial(
  quotationId: string,
  materialItemId: string,
  orgId: string,
) {
  const admin = createAdminClient();
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("id")
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quotationError) {
    return { admin, error: "Unable to validate quotation", status: 500 };
  }

  if (!quotation) {
    return { admin, error: "Quotation not found", status: 404 };
  }

  const { data: materialItem, error: materialError } = await admin
    .from("quotation_material_items")
    .select("id, scope_id")
    .eq("id", materialItemId)
    .eq("quotation_id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (materialError) {
    return { admin, error: "Unable to validate material item", status: 500 };
  }

  if (!materialItem) {
    return { admin, error: "Material item not found", status: 404 };
  }

  return {
    admin,
    materialItem: materialItem as { id: string; scope_id: string },
  };
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/materials/[materialItemId]/supplier-quote">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id, materialItemId } = await context.params;
  const validation = await verifyQuotationMaterial(
    id,
    materialItemId,
    session.org_id,
  );

  if (validation.error || !validation.materialItem) {
    return jsonError(validation.error ?? "Material item not found", validation.status ?? 404);
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file") ?? formData?.get("supplier_quote");

  if (!(file instanceof File)) {
    return jsonError("Supplier quote PDF is required", 400);
  }

  if (
    !pdfMimeTypes.has(file.type.toLowerCase()) &&
    !file.name.toLowerCase().endsWith(".pdf")
  ) {
    return jsonError("Supplier quote must be a PDF", 400);
  }

  if (file.size === 0) {
    return jsonError("Supplier quote PDF is empty", 400);
  }

  if (file.size > maxPdfBytes) {
    return jsonError("Supplier quote PDF must be 10 MB or smaller", 400);
  }

  const filePath = `${session.org_id}/quotations/${id}/materials/${materialItemId}/supplier-quote.pdf`;
  const bytes = Buffer.from(await file.arrayBuffer());

  if (!hasPdfSignature(bytes)) {
    return jsonError("Supplier quote must be a valid PDF", 400);
  }

  const { data: existingDocument, error: existingDocumentError } =
    await validation.admin
      .from("quotation_material_documents")
      .select("id")
      .eq("org_id", session.org_id)
      .eq("quotation_id", id)
      .eq("material_item_id", materialItemId)
      .maybeSingle();

  if (existingDocumentError) {
    console.error("Unable to check supplier quote metadata", {
      code: existingDocumentError.code,
      message: existingDocumentError.message,
    });
    return jsonError("Unable to prepare supplier quote upload", 500);
  }

  const { error: uploadError } = await validation.admin.storage
    .from(bucketName)
    .upload(filePath, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("Unable to upload supplier quote file", {
      message: uploadError.message,
    });
    return jsonError("Unable to upload supplier quote", 500);
  }

  const documentValues = {
    org_id: session.org_id,
    quotation_id: id,
    scope_id: validation.materialItem.scope_id,
    material_item_id: materialItemId,
    storage_bucket: bucketName,
    file_name: safePdfFileName(file.name),
    file_path: filePath,
    file_size: file.size,
    mime_type: "application/pdf",
    uploaded_by: session.user.id,
  };
  const documentQuery = existingDocument
    ? validation.admin
        .from("quotation_material_documents")
        .update(documentValues)
        .eq("id", existingDocument.id)
        .eq("org_id", session.org_id)
        .eq("quotation_id", id)
        .eq("material_item_id", materialItemId)
    : validation.admin
        .from("quotation_material_documents")
        .insert(documentValues);
  const { data: document, error: documentError } = await documentQuery
    .select("*")
    .single();

  if (documentError || !document) {
    console.error("Unable to save supplier quote metadata", {
      code: documentError?.code,
      message: documentError?.message,
    });
    return jsonError("Unable to save supplier quote metadata", 500);
  }

  const { data: signedData } = await validation.admin.storage
    .from(bucketName)
    .createSignedUrl(filePath, 10 * 60);

  return NextResponse.json({
    document: {
      ...document,
      signed_url: signedData?.signedUrl ?? null,
    },
    message: "Supplier quote uploaded",
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/materials/[materialItemId]/supplier-quote">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id, materialItemId } = await context.params;
  const validation = await verifyQuotationMaterial(
    id,
    materialItemId,
    session.org_id,
  );

  if (validation.error || !validation.materialItem) {
    return jsonError(validation.error ?? "Material item not found", validation.status ?? 404);
  }

  const { data: document, error: documentError } = await validation.admin
    .from("quotation_material_documents")
    .select("*")
    .eq("org_id", session.org_id)
    .eq("quotation_id", id)
    .eq("material_item_id", materialItemId)
    .maybeSingle();

  if (documentError) {
    return jsonError("Unable to fetch supplier quote", 500);
  }

  if (!document) {
    return jsonError("Supplier quote not found", 404);
  }

  const { error: removeError } = await validation.admin.storage
    .from(document.storage_bucket || bucketName)
    .remove([document.file_path]);

  if (removeError) {
    return jsonError("Unable to remove supplier quote file", 500);
  }

  const { error: deleteError } = await validation.admin
    .from("quotation_material_documents")
    .delete()
    .eq("org_id", session.org_id)
    .eq("quotation_id", id)
    .eq("material_item_id", materialItemId);

  if (deleteError) {
    return jsonError("Unable to delete supplier quote metadata", 500);
  }

  return NextResponse.json({ message: "Supplier quote removed" });
}
