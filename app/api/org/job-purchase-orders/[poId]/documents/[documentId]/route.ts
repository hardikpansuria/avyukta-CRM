import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOwnedMutation } from "@/lib/auth/data-scope";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  isExpectedPurchaseOrderDocumentPath,
  jobDocumentBuckets,
  replacePurchaseOrderDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<
    "/api/org/job-purchase-orders/[poId]/documents/[documentId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "edit");
  if (denied) return denied;
  const { poId, documentId } = await context.params;
  const admin = createAdminClient();

  const [{ data: document, error: documentError }, { data: allocations, error: allocationsError }] =
    await Promise.all([
      admin
        .from("job_purchase_order_documents")
        .select("id,document_type,file_name,file_path,file_size,mime_type")
        .eq("id", documentId)
        .eq("purchase_order_id", poId)
        .eq("org_id", session.org_id)
        .maybeSingle(),
      admin
        .from("job_purchase_order_allocations")
        .select("job_id")
        .eq("purchase_order_id", poId)
        .eq("org_id", session.org_id)
        .eq("is_active", true),
    ]);
  if (documentError || allocationsError) {
    return jsonError("Unable to validate Purchase Order document", 500);
  }
  if (!document) return jsonError("Document not found", 404);
  if (document.document_type === "po_revision") {
    return jsonError("Revision documents are immutable. Upload a new PO revision instead.", 409);
  }

  const jobIds = (allocations ?? []).map((allocation) => allocation.job_id);
  const { data: jobs, error: jobsError } = jobIds.length
    ? await admin
        .from("jobs")
        .select("id,salesperson_id")
        .eq("org_id", session.org_id)
        .in("id", jobIds)
    : { data: [], error: null };
  if (jobsError) return jsonError("Unable to validate Purchase Order access", 500);
  const scopeDenied = await requireOwnedMutation(
    session,
    "purchase_orders",
    (jobs ?? []).map((job) => job.salesperson_id),
    "all",
  );
  if (scopeDenied) return scopeDenied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }
  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return jsonError("Select a replacement file", 400);
  }
  const validationError = validateDocument(entry, {
    pdfOnly: document.document_type === "purchase_order",
  });
  if (validationError) return jsonError(validationError, 400);

  const result = await replacePurchaseOrderDocument({
    admin,
    orgId: session.org_id,
    purchaseOrderId: poId,
    documentId,
    actorId: session.user.id,
    file: entry,
  });
  if (result.error || !result.document) {
    return jsonError(result.error ?? "Unable to replace document", 500);
  }

  const { error: auditError } = await admin.from("job_purchase_order_activity").insert({
    org_id: session.org_id,
    purchase_order_id: poId,
    action: "document_replaced",
    actor_id: session.user.id,
    before_data: result.previousDocument,
    after_data: {
      id: result.document.id,
      file_name: result.document.file_name,
      file_size: result.document.file_size,
      mime_type: result.document.mime_type,
    },
  });
  if (auditError) {
    console.error("Unable to record Purchase Order document replacement", {
      code: auditError.code,
      message: auditError.message,
    });
  }

  return NextResponse.json({
    document: result.document,
    warning: result.cleanupWarning,
  });
}

export async function GET(
  request: Request,
  context: RouteContext<
    "/api/org/job-purchase-orders/[poId]/documents/[documentId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "view");
  if (denied) return denied;
  const { poId, documentId } = await context.params;
  const admin = createAdminClient();
  const { data: document, error } = await admin
    .from("job_purchase_order_documents")
    .select("id,purchase_order_id,file_name,file_path,mime_type")
    .eq("id", documentId)
    .eq("purchase_order_id", poId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (error) return jsonError("Unable to validate document", 500);
  if (!document) return jsonError("Document not found", 404);
  if (
    !isExpectedPurchaseOrderDocumentPath({
      path: document.file_path,
      orgId: session.org_id,
      purchaseOrderId: poId,
      documentId,
    })
  ) {
    return jsonError("Document path is invalid", 409);
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data, error: signedError } = await admin.storage
    .from(jobDocumentBuckets.purchaseOrders)
    .createSignedUrl(document.file_path, 5 * 60, {
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
