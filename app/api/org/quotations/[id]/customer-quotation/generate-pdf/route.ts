import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  calculateCustomerQuotationItems,
  getCustomerQuotationData,
} from "@/lib/quotations/customer-quotation";
import {
  renderCustomerQuotationPdf,
  type CustomerQuotationPdfData,
} from "@/lib/quotations/customer-quotation-pdf";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const bucketName = "customer-quotation-pdfs";

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

async function logoDataUrl(signedUrl: unknown) {
  if (typeof signedUrl !== "string" || !signedUrl) return null;

  const response = await fetch(signedUrl, { cache: "no-store" });
  if (!response.ok) return null;

  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation/generate-pdf">,
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

  if (!result.value.exists) {
    return jsonError("Save the customer quotation draft before generating", 400);
  }

  const document = result.value.document as Record<string, unknown>;
  const customerDocumentId = String(document.id);
  const calculated = calculateCustomerQuotationItems(result.value.items);
  const generatedDocumentId = crypto.randomUUID();
  const revisionNumber = Number(document.revision_number_snapshot ?? 0);
  const quotationNumber = safeFilePart(document.quotation_number_snapshot);
  const fileName = `${quotationNumber}-revision-${revisionNumber}-${generatedDocumentId.slice(0, 8)}.pdf`;
  const filePath = `${session.org_id}/quotations/${id}/customer-quotations/revision-${revisionNumber}/${generatedDocumentId}.pdf`;
  const logo = await logoDataUrl(result.value.organization.logo_signed_url);
  const pdfData: CustomerQuotationPdfData = {
    organization: result.value.organization,
    logo_data_url: logo,
    document: {
      ...document,
      subtotal: calculated.subtotal,
      total: calculated.total,
    },
    items: calculated.items,
  };

  let pdfBuffer: Buffer;

  try {
    pdfBuffer = await renderCustomerQuotationPdf(pdfData);
  } catch (error) {
    console.error("Unable to render customer quotation PDF", error);
    return jsonError("Unable to render customer quotation PDF", 500);
  }

  const { error: uploadError } = await admin.storage
    .from(bucketName)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    return jsonError("Unable to store customer quotation PDF", 500);
  }

  const generatedAt = new Date().toISOString();
  const { data: generatedDocument, error: historyError } = await admin
    .from("quotation_generated_documents")
    .insert({
      id: generatedDocumentId,
      org_id: session.org_id,
      quotation_id: id,
      customer_document_id: customerDocumentId,
      revision_number: revisionNumber,
      file_name: fileName,
      file_path: filePath,
      file_size: pdfBuffer.length,
      generated_by: session.user.id,
      generated_at: generatedAt,
    })
    .select("*")
    .single();

  if (historyError || !generatedDocument) {
    await admin.storage.from(bucketName).remove([filePath]);
    return jsonError("Unable to save generated document history", 500);
  }

  await Promise.all(
    calculated.items.map((item, index) => {
      const savedItem = result.value!.items[index] as Record<string, unknown>;
      return admin
        .from("quotation_customer_document_items")
        .update({
          imported_scope_amount: item.imported_scope_amount,
          estimation_quantity: item.estimation_quantity,
          quantity: item.quantity,
          price_each: item.price_each,
          price_ext: item.price_ext,
        })
        .eq("id", savedItem.id)
        .eq("org_id", session.org_id)
        .eq("quotation_id", id)
        .eq("customer_document_id", customerDocumentId);
    }),
  );

  const { error: documentUpdateError } = await admin
    .from("quotation_customer_documents")
    .update({
      document_status: "generated",
      subtotal: calculated.subtotal,
      total: calculated.total,
      generated_pdf_storage_path: filePath,
      generated_at: generatedAt,
      updated_by: session.user.id,
    })
    .eq("id", customerDocumentId)
    .eq("org_id", session.org_id)
    .eq("quotation_id", id);

  if (documentUpdateError) {
    return jsonError("PDF generated, but draft status could not be updated", 500);
  }

  const { data: signedData } = await admin.storage
    .from(bucketName)
    .createSignedUrl(filePath, 10 * 60);

  return NextResponse.json({
    document: {
      ...generatedDocument,
      signed_url: signedData?.signedUrl ?? null,
    },
  });
}
