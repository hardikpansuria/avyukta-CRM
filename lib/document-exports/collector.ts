import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { OrgSession } from "@/lib/auth/verify-org-session";

import { assignZipPaths, formatExportFilename } from "./format";
import type { DocumentExportCollection, DocumentExportWindow, ExportDocument } from "./types";

const CUSTOMER_QUOTATION_BUCKET = "customer-quotation-pdfs";
const QUOTATION_BUCKET = "quotation-documents";
const PO_BUCKET = "job-purchase-order-documents";
const INVOICE_REQUEST_BUCKET = "invoice-request-documents";
const INVOICE_BUCKET = "job-invoice-documents";

export class DocumentCollectionError extends Error {}

type CustomerRow = { id: string; company_name: string; customer_code: string | null };
type QuotationRow = {
  id: string;
  customer_id: string;
  quotation_number: string;
  revision_number: number;
};
type AllocationRow = {
  purchase_order_id: string;
  job_id: string;
  quotation_id_snapshot: string;
  quotation_number_snapshot: string;
  revision_number_snapshot: number;
};
type JobRow = { id: string; job_number: string | null; customer_id: string };
type PoRow = { id: string; customer_id: string; po_number: string };
type InvoiceRow = {
  id: string;
  job_id: string;
  purchase_order_id: string;
  invoice_number: string;
};
type InvoiceRequestRow = {
  id: string;
  job_id: string;
  purchase_order_id: string;
  quotation_number_snapshot: string;
  revision_number_snapshot: number;
};

function numericSize(value: unknown) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

function dateWithinWindow(documentDate: string, window: DocumentExportWindow) {
  const timestamp = Date.parse(documentDate);
  const snapshot = Date.parse(window.snapshotAt);
  if (!Number.isFinite(timestamp) || timestamp > snapshot) return false;
  if (!window.fromUtc || !window.toUtc) return true;
  return timestamp >= Date.parse(window.fromUtc) && timestamp <= Date.parse(window.toUtc);
}

function requireRelation<T>(value: T | undefined, description: string): T {
  if (!value) throw new DocumentCollectionError(`Unable to resolve ${description}.`);
  return value;
}

function documentBase(
  sourceId: string,
  customer: CustomerRow,
  values: Partial<ExportDocument>,
): ExportDocument {
  return {
    sourceId,
    customerId: customer.id,
    customerName: customer.company_name,
    customerCode: customer.customer_code,
    quotationNumber: null,
    revisionNumber: null,
    jobNumber: null,
    poNumber: null,
    invoiceNumber: null,
    category: "Documents",
    originalFilename: "Document",
    bucket: "",
    storagePath: "",
    documentDate: "",
    fileSize: null,
    mimeType: null,
    zipPath: "",
    ...values,
  };
}

export async function collectOrganizationDocuments(
  admin: SupabaseClient,
  session: OrgSession,
  window: DocumentExportWindow,
): Promise<DocumentExportCollection> {
  const materialQuery = admin
    .from("quotation_material_documents")
    .select("id,quotation_id,file_name,file_path,file_size,mime_type,created_at,updated_at")
    .eq("org_id", session.org_id);
  const scopeQuery = admin
    .from("quotation_scope_charge_documents")
    .select("id,quotation_id,file_name,file_path,file_size,mime_type,created_at,updated_at")
    .eq("org_id", session.org_id);
  const generatedQuery = admin
    .from("quotation_generated_documents")
    .select("id,quotation_id,revision_number,file_name,file_path,file_size,generated_at")
    .eq("org_id", session.org_id)
    .lte("generated_at", window.snapshotAt);
  const poDocumentQuery = admin
    .from("job_purchase_order_documents")
    .select("id,purchase_order_id,file_name,file_path,file_size,mime_type,uploaded_at")
    .eq("org_id", session.org_id)
    .lte("uploaded_at", window.snapshotAt);
  const requestDocumentQuery = admin
    .from("invoice_request_documents")
    .select("id,invoice_request_id,file_name,file_path,file_size,mime_type,uploaded_at")
    .eq("org_id", session.org_id)
    .lte("uploaded_at", window.snapshotAt);
  const invoiceDocumentQuery = admin
    .from("job_invoice_documents")
    .select("id,invoice_id,file_name,file_path,file_size,mime_type,uploaded_at")
    .eq("org_id", session.org_id)
    .lte("uploaded_at", window.snapshotAt);

  if (window.fromUtc && window.toUtc) {
    generatedQuery.gte("generated_at", window.fromUtc).lte("generated_at", window.toUtc);
    poDocumentQuery.gte("uploaded_at", window.fromUtc).lte("uploaded_at", window.toUtc);
    requestDocumentQuery.gte("uploaded_at", window.fromUtc).lte("uploaded_at", window.toUtc);
    invoiceDocumentQuery.gte("uploaded_at", window.fromUtc).lte("uploaded_at", window.toUtc);
  }

  const [
    customersResult,
    quotationsResult,
    jobsResult,
    purchaseOrdersResult,
    allocationsResult,
    invoicesResult,
    invoiceRequestsResult,
    materialResult,
    scopeResult,
    generatedResult,
    poDocumentResult,
    requestDocumentResult,
    invoiceDocumentResult,
  ] = await Promise.all([
    admin.from("customers").select("id,company_name,customer_code").eq("org_id", session.org_id),
    admin.from("quotations").select("id,customer_id,quotation_number,revision_number").eq("org_id", session.org_id),
    admin.from("jobs").select("id,job_number,customer_id").eq("org_id", session.org_id),
    admin.from("job_purchase_orders").select("id,customer_id,po_number").eq("org_id", session.org_id),
    admin.from("job_purchase_order_allocations").select("purchase_order_id,job_id,quotation_id_snapshot,quotation_number_snapshot,revision_number_snapshot").eq("org_id", session.org_id),
    admin.from("job_invoices").select("id,job_id,purchase_order_id,invoice_number").eq("org_id", session.org_id),
    admin.from("invoice_requests").select("id,job_id,purchase_order_id,quotation_number_snapshot,revision_number_snapshot").eq("org_id", session.org_id),
    materialQuery,
    scopeQuery,
    generatedQuery,
    poDocumentQuery,
    requestDocumentQuery,
    invoiceDocumentQuery,
  ]);

  const results = [
    customersResult, quotationsResult, jobsResult, purchaseOrdersResult, allocationsResult,
    invoicesResult, invoiceRequestsResult, materialResult, scopeResult, generatedResult,
    poDocumentResult, requestDocumentResult, invoiceDocumentResult,
  ];
  const queryError = results.find((result) => result.error)?.error;
  if (queryError) {
    console.error("Unable to collect organization document metadata", {
      code: queryError.code,
      message: queryError.message,
      orgId: session.org_id,
    });
    throw new DocumentCollectionError("Unable to collect document metadata.");
  }

  const customers = new Map((customersResult.data as CustomerRow[]).map((row) => [row.id, row]));
  const quotations = new Map((quotationsResult.data as QuotationRow[]).map((row) => [row.id, row]));
  const jobs = new Map((jobsResult.data as JobRow[]).map((row) => [row.id, row]));
  const purchaseOrders = new Map((purchaseOrdersResult.data as PoRow[]).map((row) => [row.id, row]));
  const allocations = allocationsResult.data as AllocationRow[];
  const allocationByJob = new Map(allocations.map((row) => [row.job_id, row]));
  const allocationsByPo = new Map<string, AllocationRow[]>();
  allocations.forEach((row) => allocationsByPo.set(row.purchase_order_id, [...(allocationsByPo.get(row.purchase_order_id) ?? []), row]));
  const invoices = new Map((invoicesResult.data as InvoiceRow[]).map((row) => [row.id, row]));
  const requests = new Map((invoiceRequestsResult.data as InvoiceRequestRow[]).map((row) => [row.id, row]));
  const documents: ExportDocument[] = [];

  const quotationContext = (quotationId: string) => {
    const quotation = requireRelation(quotations.get(quotationId), "a document's quotation");
    const customer = requireRelation(customers.get(quotation.customer_id), "a quotation's customer");
    return { quotation, customer };
  };

  for (const row of materialResult.data ?? []) {
    const documentDate = row.updated_at ?? row.created_at;
    if (!documentDate || !dateWithinWindow(documentDate, window)) continue;
    const { quotation, customer } = quotationContext(row.quotation_id);
    documents.push(documentBase(row.id, customer, {
      quotationNumber: quotation.quotation_number, revisionNumber: quotation.revision_number,
      category: "Quotation", originalFilename: row.file_name, bucket: QUOTATION_BUCKET,
      storagePath: row.file_path, documentDate,
      fileSize: numericSize(row.file_size), mimeType: row.mime_type,
    }));
  }
  for (const row of scopeResult.data ?? []) {
    const documentDate = row.updated_at ?? row.created_at;
    if (!documentDate || !dateWithinWindow(documentDate, window)) continue;
    const { quotation, customer } = quotationContext(row.quotation_id);
    documents.push(documentBase(row.id, customer, {
      quotationNumber: quotation.quotation_number, revisionNumber: quotation.revision_number,
      category: "Quotation", originalFilename: row.file_name, bucket: QUOTATION_BUCKET,
      storagePath: row.file_path, documentDate,
      fileSize: numericSize(row.file_size), mimeType: row.mime_type,
    }));
  }
  for (const row of generatedResult.data ?? []) {
    const { quotation, customer } = quotationContext(row.quotation_id);
    documents.push(documentBase(row.id, customer, {
      quotationNumber: quotation.quotation_number, revisionNumber: row.revision_number,
      category: "Customer_Quotation", originalFilename: row.file_name,
      bucket: CUSTOMER_QUOTATION_BUCKET, storagePath: row.file_path,
      documentDate: row.generated_at, fileSize: numericSize(row.file_size), mimeType: "application/pdf",
    }));
  }
  for (const row of poDocumentResult.data ?? []) {
    const po = requireRelation(purchaseOrders.get(row.purchase_order_id), "a document's purchase order");
    const customer = requireRelation(customers.get(po.customer_id), "a purchase order's customer");
    const poAllocations = allocationsByPo.get(po.id) ?? [];
    const allocation = poAllocations.length === 1 ? poAllocations[0] : undefined;
    const job = allocation ? jobs.get(allocation.job_id) : undefined;
    documents.push(documentBase(row.id, customer, {
      quotationNumber: allocation?.quotation_number_snapshot ?? null,
      revisionNumber: allocation?.revision_number_snapshot ?? null,
      jobNumber: job?.job_number ?? null, poNumber: po.po_number,
      category: "Customer_PO", originalFilename: row.file_name, bucket: PO_BUCKET,
      storagePath: row.file_path, documentDate: row.uploaded_at,
      fileSize: numericSize(row.file_size), mimeType: row.mime_type,
    }));
  }
  for (const row of requestDocumentResult.data ?? []) {
    const request = requireRelation(requests.get(row.invoice_request_id), "an invoice request document's request");
    const job = requireRelation(jobs.get(request.job_id), "an invoice request's job");
    const po = requireRelation(purchaseOrders.get(request.purchase_order_id), "an invoice request's purchase order");
    const customer = requireRelation(customers.get(job.customer_id), "an invoice request's customer");
    documents.push(documentBase(row.id, customer, {
      quotationNumber: request.quotation_number_snapshot,
      revisionNumber: request.revision_number_snapshot, jobNumber: job.job_number,
      poNumber: po.po_number, category: "Invoice_Request", originalFilename: row.file_name,
      bucket: INVOICE_REQUEST_BUCKET, storagePath: row.file_path, documentDate: row.uploaded_at,
      fileSize: numericSize(row.file_size), mimeType: row.mime_type,
    }));
  }
  for (const row of invoiceDocumentResult.data ?? []) {
    const invoice = requireRelation(invoices.get(row.invoice_id), "an invoice document's invoice");
    const job = requireRelation(jobs.get(invoice.job_id), "an invoice's job");
    const po = requireRelation(purchaseOrders.get(invoice.purchase_order_id), "an invoice's purchase order");
    const allocation = requireRelation(allocationByJob.get(invoice.job_id), "an invoice's accepted quotation");
    const customer = requireRelation(customers.get(job.customer_id), "an invoice's customer");
    documents.push(documentBase(row.id, customer, {
      quotationNumber: allocation.quotation_number_snapshot,
      revisionNumber: allocation.revision_number_snapshot, jobNumber: job.job_number,
      poNumber: po.po_number, invoiceNumber: invoice.invoice_number, category: "Invoices",
      originalFilename: row.file_name, bucket: INVOICE_BUCKET, storagePath: row.file_path,
      documentDate: row.uploaded_at, fileSize: numericSize(row.file_size), mimeType: row.mime_type,
    }));
  }

  const filename = formatExportFilename(session.org_name, window);
  documents.sort((left, right) =>
    [left.customerName, left.quotationNumber, left.revisionNumber, left.category, left.originalFilename, left.sourceId]
      .map(String)
      .join("\u0000")
      .localeCompare(
        [right.customerName, right.quotationNumber, right.revisionNumber, right.category, right.originalFilename, right.sourceId]
          .map(String)
          .join("\u0000"),
      ),
  );
  assignZipPaths(documents, filename.slice(0, -4));
  return {
    organizationName: session.org_name,
    generatedBy: session.user.user_metadata?.full_name?.trim() || session.user.email || "Authorized CRM user",
    window,
    documents,
  };
}
