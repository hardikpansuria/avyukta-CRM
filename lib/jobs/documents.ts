import type { SupabaseClient } from "@supabase/supabase-js";

import { isOrgScopedStoragePath } from "@/lib/supabase/storage-path";

const PURCHASE_ORDER_BUCKET = "job-purchase-order-documents";
const INVOICE_BUCKET = "job-invoice-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedDocumentTypes = new Map([
  ["pdf", "application/pdf"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  [
    "docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [
    "xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
]);

function fileExtension(fileName: string) {
  const separator = fileName.lastIndexOf(".");
  return separator >= 0 ? fileName.slice(separator + 1).toLowerCase() : "";
}

export function sanitizeFileName(fileName: string) {
  const safe = fileName
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 160);
  return safe || "document";
}

export function validateDocument(
  file: File,
  options: { pdfOnly?: boolean } = {},
) {
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_FILE_SIZE) return "Each document must be 15 MB or less.";
  const extension = fileExtension(file.name);
  const expectedMimeType = allowedDocumentTypes.get(extension);
  if (options.pdfOnly && (extension !== "pdf" || file.type !== "application/pdf")) {
    return "The purchase order document must be a PDF.";
  }
  if (!options.pdfOnly && (!expectedMimeType || file.type !== expectedMimeType)) {
    return "Supporting documents must be PDF, JPEG, PNG, DOCX, or XLSX files.";
  }
  return null;
}

export function isExpectedPurchaseOrderDocumentPath(args: {
  path: string;
  orgId: string;
  purchaseOrderId: string;
  documentId: string;
}) {
  return (
    isOrgScopedStoragePath(args.path, args.orgId) &&
    args.path.startsWith(
      `${args.orgId}/purchase-orders/${args.purchaseOrderId}/${args.documentId}-`,
    )
  );
}

export function isExpectedInvoiceDocumentPath(args: {
  path: string;
  orgId: string;
  jobId: string;
  invoiceId: string;
  documentId: string;
}) {
  return (
    isOrgScopedStoragePath(args.path, args.orgId) &&
    args.path.startsWith(
      `${args.orgId}/jobs/${args.jobId}/invoices/${args.invoiceId}/${args.documentId}-`,
    )
  );
}

export async function uploadPurchaseOrderDocument(args: {
  admin: SupabaseClient;
  orgId: string;
  purchaseOrderId: string;
  actorId: string;
  file: File;
  documentType: "purchase_order" | "supporting_document";
}) {
  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(args.file.name);
  const path = `${args.orgId}/purchase-orders/${args.purchaseOrderId}/${id}-${safeName}`;
  const { error: uploadError } = await args.admin.storage
    .from(PURCHASE_ORDER_BUCKET)
    .upload(path, await args.file.arrayBuffer(), {
      contentType: args.file.type,
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: document, error: metadataError } = await args.admin
    .from("job_purchase_order_documents")
    .insert({
      id,
      org_id: args.orgId,
      purchase_order_id: args.purchaseOrderId,
      document_type: args.documentType,
      file_name: args.file.name,
      file_path: path,
      file_size: args.file.size,
      mime_type: args.file.type,
      uploaded_by: args.actorId,
    })
    .select("*")
    .single();

  if (metadataError) {
    await args.admin.storage.from(PURCHASE_ORDER_BUCKET).remove([path]);
    return { error: metadataError.message };
  }

  return { document, error: null };
}

export async function uploadInvoiceDocument(args: {
  admin: SupabaseClient;
  orgId: string;
  jobId: string;
  invoiceId: string;
  actorId: string;
  file: File;
}) {
  const id = crypto.randomUUID();
  const safeName = sanitizeFileName(args.file.name);
  const path = `${args.orgId}/jobs/${args.jobId}/invoices/${args.invoiceId}/${id}-${safeName}`;
  const { error: uploadError } = await args.admin.storage
    .from(INVOICE_BUCKET)
    .upload(path, await args.file.arrayBuffer(), {
      contentType: args.file.type,
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const { data: document, error: metadataError } = await args.admin
    .from("job_invoice_documents")
    .insert({
      id,
      org_id: args.orgId,
      invoice_id: args.invoiceId,
      file_name: args.file.name,
      file_path: path,
      file_size: args.file.size,
      mime_type: args.file.type,
      uploaded_by: args.actorId,
    })
    .select("*")
    .single();
  if (metadataError) {
    await args.admin.storage.from(INVOICE_BUCKET).remove([path]);
    return { error: metadataError.message };
  }
  return { document, error: null };
}

export const jobDocumentBuckets = {
  purchaseOrders: PURCHASE_ORDER_BUCKET,
  invoices: INVOICE_BUCKET,
};
