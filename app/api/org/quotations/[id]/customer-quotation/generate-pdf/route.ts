import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  getCustomerQuotationData,
} from "@/lib/quotations/customer-quotation";
import {
  renderCustomerQuotationPdf,
  type CustomerQuotationPdfData,
} from "@/lib/quotations/customer-quotation-pdf";
import { isCustomerDocumentType } from "@/lib/quotations/customer-document-type";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrgScopedStoragePath } from "@/lib/supabase/storage-path";
import { getQuotationLock, lockedRevisionMessage, logRevisionAudit } from "@/lib/quotations/revisions";
import { syncCustomerQuotationPricing } from "@/lib/quotations/sync-customer-quotation-pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const bucketName = "customer-quotation-pdfs";
const maxPdfBytes = 50 * 1024 * 1024;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function safeFilePart(value: unknown) {
  return (
    String(value ?? "quotation")
      .trim()
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "quotation"
  );
}

async function logoDataUrl(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  storagePath: unknown,
) {
  if (
    typeof storagePath !== "string" ||
    !isOrgScopedStoragePath(storagePath, orgId)
  ) {
    return null;
  }

  const { data, error } = await admin.storage
    .from("crm-assets")
    .download(storagePath);
  if (error || !data) return null;

  const contentType = data.type || "image/png";
  const bytes = Buffer.from(await data.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation/generate-pdf">,
) {
  const startedAt = performance.now();
  const timings: Record<string, number> = {};
  const mark = (name: string, stageStartedAt: number) => {
    timings[name] = Math.round(performance.now() - stageStartedAt);
  };
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "quotations", "view");
  if (denied) return denied;

  const { id } = await context.params;
  const admin = createAdminClient();
  let stageStartedAt = performance.now();
  const { data: lock } = await getQuotationLock(admin, session.org_id, id);
  mark("lock_ms", stageStartedAt);
  if (lock?.is_locked) return jsonError(lockedRevisionMessage, 409);
  stageStartedAt = performance.now();
  const syncResult = await syncCustomerQuotationPricing({
    orgId: session.org_id,
    quotationId: id,
    actorId: session.user.id,
    adminClient: admin,
  });
  mark("pricing_sync_ms", stageStartedAt);
  if (syncResult.error) {
    return jsonError("Unable to synchronize customer quotation pricing", 500);
  }
  stageStartedAt = performance.now();
  const result = await getCustomerQuotationData(admin, session.org_id, id, {
    includeLogoSignedUrl: false,
  });
  mark("data_load_ms", stageStartedAt);

  if (result.notFound) return jsonError("Quotation not found", 404);
  if (result.error || !result.value) {
    return jsonError("Unable to fetch customer quotation", 500);
  }

  if (!result.value.exists) {
    return jsonError("Save the customer quotation draft before generating", 400);
  }

  const document = result.value.document as Record<string, unknown>;
  const documentType = document.document_type;
  if (!isCustomerDocumentType(documentType)) {
    return jsonError("Select a document type before generating", 400);
  }
  const customerDocumentId = String(document.id);
  const generatedDocumentId = crypto.randomUUID();
  const revisionNumber = Number(document.revision_number_snapshot ?? 0);
  const quotationNumber = safeFilePart(document.quotation_number_snapshot);
  const fileName = `${quotationNumber}-revision-${revisionNumber}-${generatedDocumentId.slice(0, 8)}.pdf`;
  const filePath = `${session.org_id}/quotations/${id}/customer-quotations/revision-${revisionNumber}/${generatedDocumentId}.pdf`;
  stageStartedAt = performance.now();
  const logo = await logoDataUrl(
    admin,
    session.org_id,
    result.value.organization.logo_storage_path,
  );
  mark("logo_download_ms", stageStartedAt);
  const pdfData: CustomerQuotationPdfData = {
    organization: result.value.organization,
    logo_data_url: logo,
    document: {
      ...document,
      ...result.value.pricing_summary,
    },
    items: result.value.items,
  };

  let pdfBuffer: Buffer;

  try {
    stageStartedAt = performance.now();
    pdfBuffer = await renderCustomerQuotationPdf(pdfData);
    mark("pdf_render_ms", stageStartedAt);
  } catch (error) {
    console.error("Unable to render customer quotation PDF", error);
    return jsonError("Unable to render customer quotation PDF", 500);
  }

  if (pdfBuffer.length === 0 || pdfBuffer.length > maxPdfBytes) {
    return jsonError("Generated customer quotation PDF has an invalid size", 500);
  }

  stageStartedAt = performance.now();
  const { error: uploadError } = await admin.storage
    .from(bucketName)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  mark("pdf_upload_ms", stageStartedAt);

  if (uploadError) {
    return jsonError("Unable to store customer quotation PDF", 500);
  }

  const generatedAt = new Date().toISOString();
  stageStartedAt = performance.now();
  const { data: generatedDocument, error: historyError } = await admin
    .from("quotation_generated_documents")
    .insert({
      id: generatedDocumentId,
      org_id: session.org_id,
      quotation_id: id,
      customer_document_id: customerDocumentId,
      document_type: documentType,
      revision_number: revisionNumber,
      file_name: fileName,
      file_path: filePath,
      file_size: pdfBuffer.length,
      generated_by: session.user.id,
      generated_at: generatedAt,
    })
    .select("*")
    .single();
  mark("history_insert_ms", stageStartedAt);

  if (historyError || !generatedDocument) {
    await admin.storage.from(bucketName).remove([filePath]);
    return jsonError("Unable to save generated document history", 500);
  }

  stageStartedAt = performance.now();
  const { error: documentUpdateError } = await admin
    .from("quotation_customer_documents")
    .update({
      document_status: "generated",
      generated_pdf_storage_path: filePath,
      generated_at: generatedAt,
      updated_by: session.user.id,
    })
    .eq("id", customerDocumentId)
    .eq("org_id", session.org_id)
    .eq("quotation_id", id);
  mark("document_update_ms", stageStartedAt);

  if (documentUpdateError) {
    return jsonError("PDF generated, but draft status could not be updated", 500);
  }

  stageStartedAt = performance.now();
  const [signedUrlResult, generatorProfileResult] = await Promise.all([
    admin.storage.from(bucketName).createSignedUrl(filePath, 10 * 60),
    admin
      .from("profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle(),
  ]);
  mark("response_metadata_ms", stageStartedAt);

  stageStartedAt = performance.now();
  await logRevisionAudit(admin, { ...lock, id, org_id: session.org_id }, session.user.id, "customer_pdf_generated", {
    generated_document_id: generatedDocumentId,
    file_name: fileName,
  });
  mark("audit_ms", stageStartedAt);
  timings.total_ms = Math.round(performance.now() - startedAt);
  console.info("Customer quotation PDF generation timings", {
    timings,
    item_count: result.value.items.length,
    pdf_bytes: pdfBuffer.length,
  });

  return NextResponse.json({
    document: {
      ...generatedDocument,
      generated_by_name:
        generatorProfileResult.data?.full_name?.trim() || "System",
      signed_url: signedUrlResult.data?.signedUrl ?? null,
    },
  });
}
