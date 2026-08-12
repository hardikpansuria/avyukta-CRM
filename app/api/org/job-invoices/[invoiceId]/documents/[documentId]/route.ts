import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  isExpectedInvoiceDocumentPath,
  jobDocumentBuckets,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  request: Request,
  context: RouteContext<
    "/api/org/job-invoices/[invoiceId]/documents/[documentId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "view");
  if (denied) return denied;
  const { invoiceId, documentId } = await context.params;
  const admin = createAdminClient();
  const { data: invoice, error: invoiceError } = await admin
    .from("job_invoices")
    .select("id,job_id")
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (invoiceError) return jsonError("Unable to validate invoice", 500);
  if (!invoice) return jsonError("Invoice not found", 404);
  const { data: document, error } = await admin
    .from("job_invoice_documents")
    .select("id,file_name,file_path")
    .eq("id", documentId)
    .eq("invoice_id", invoiceId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate invoice document", 500);
  if (!document) return jsonError("Invoice document not found", 404);
  if (
    !isExpectedInvoiceDocumentPath({
      path: document.file_path,
      orgId: session.org_id,
      jobId: invoice.job_id,
      invoiceId,
      documentId,
    })
  ) {
    return jsonError("Invoice document path is invalid", 409);
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error: signedError } = await admin.storage
    .from(jobDocumentBuckets.invoices)
    .createSignedUrl(document.file_path, 300, {
      download: download ? document.file_name : false,
    });
  if (signedError || !data?.signedUrl) {
    return jsonError("Unable to create document link", 500);
  }
  return NextResponse.json({
    signed_url: data.signedUrl,
    expires_in: 300,
    file_name: document.file_name,
  });
}
