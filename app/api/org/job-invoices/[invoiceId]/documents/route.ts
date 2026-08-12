import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  uploadInvoiceDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/job-invoices/[invoiceId]/documents">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "edit");
  if (denied) return denied;
  const { invoiceId } = await context.params;
  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from("job_invoices")
    .select("id,job_id")
    .eq("id", invoiceId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (error) return jsonError("Unable to validate invoice", 500);
  if (!invoice) return jsonError("Invoice not found", 404);
  const form = await request.formData();
  const entry = form.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return jsonError("Select an invoice PDF", 400);
  }
  const validationError = validateDocument(entry, { pdfOnly: true });
  if (validationError) return jsonError(validationError, 400);
  const result = await uploadInvoiceDocument({
    admin,
    orgId: session.org_id,
    jobId: invoice.job_id,
    invoiceId,
    actorId: session.user.id,
    file: entry,
  });
  if (result.error) return jsonError("Unable to upload invoice PDF", 500);
  return NextResponse.json({ document: result.document }, { status: 201 });
}
