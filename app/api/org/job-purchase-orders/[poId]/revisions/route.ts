import { NextResponse } from "next/server";

import { requireOrgPermission, hasOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { listJobs } from "@/lib/jobs/data";
import {
  uploadPurchaseOrderDocument,
  validateDocument,
  jobDocumentBuckets,
} from "@/lib/jobs/documents";
import { getPurchaseOrder } from "@/lib/jobs/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AddedAllocation = {
  job_id?: unknown;
  po_amount_before_tax?: unknown;
  difference_acknowledged?: unknown;
  scope_ids?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ poId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "view");
  if (denied) return denied;

  const { poId } = await context.params;
  const admin = createAdminClient();
  const poResult = await getPurchaseOrder(admin, session.org_id, poId);
  if (poResult.error) return jsonError("Unable to fetch purchase order", 500);
  if (!poResult.purchaseOrder) return jsonError("Purchase order not found", 404);

  const allowCustomerOverride =
    new URL(request.url).searchParams.get("override_customer") === "1" &&
    session.role === "admin";
  const candidates = await listJobs(admin, session.org_id, {
    status: "po_pending",
    customerId: allowCustomerOverride
      ? undefined
      : poResult.purchaseOrder.customer_id,
    page: 1,
    pageSize: 100,
  });
  if (candidates.error) return jsonError("Unable to fetch available quotations", 500);

  return NextResponse.json({
    purchase_order: poResult.purchaseOrder,
    available_jobs: candidates.jobs.filter(
      (job) =>
        !allowCustomerOverride ||
        !job.quotation?.currency ||
        job.quotation.currency === poResult.purchaseOrder!.currency,
    ),
    permissions: {
      can_create_revision: await hasOrgPermission(
        session,
        "purchase_orders",
        "attach_po",
      ),
      can_override_customer: session.role === "admin",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ poId: string }> },
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "attach_po");
  if (denied) return denied;

  const { poId } = await context.params;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const revisionDate = stringValue(formData.get("revision_date"));
  const remarks = stringValue(formData.get("internal_remarks")) || null;
  const allowCustomerOverride =
    formData.get("allow_customer_override") === "true" && session.role === "admin";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(revisionDate)) {
    return jsonError("Revision date is required", 400);
  }

  let rawAdded: AddedAllocation[];
  let removedIds: string[];
  try {
    rawAdded = JSON.parse(stringValue(formData.get("added_allocations")) || "[]") as AddedAllocation[];
    removedIds = JSON.parse(stringValue(formData.get("removed_allocation_ids")) || "[]") as string[];
  } catch {
    return jsonError("Revision changes are invalid", 400);
  }
  if (!Array.isArray(rawAdded) || !Array.isArray(removedIds)) {
    return jsonError("Revision changes are invalid", 400);
  }

  const addedAllocations = rawAdded.map((allocation) => ({
    job_id: typeof allocation.job_id === "string" ? allocation.job_id.trim() : "",
    po_amount_before_tax: Number(allocation.po_amount_before_tax),
    difference_acknowledged: allocation.difference_acknowledged === true,
    scope_ids: Array.isArray(allocation.scope_ids)
      ? Array.from(new Set(allocation.scope_ids.filter((value): value is string => typeof value === "string")))
      : [],
  }));
  if (
    addedAllocations.some(
      (allocation) =>
        !allocation.job_id ||
        !Number.isFinite(allocation.po_amount_before_tax) ||
        allocation.po_amount_before_tax < 0 ||
        allocation.scope_ids.length === 0,
    ) ||
    new Set(addedAllocations.map((allocation) => allocation.job_id)).size !== addedAllocations.length ||
    removedIds.some((id) => typeof id !== "string" || !id)
  ) {
    return jsonError("Every added quotation requires a valid amount and scope", 400);
  }
  if (!addedAllocations.length && !removedIds.length) {
    return jsonError("Add or remove at least one quotation", 400);
  }

  const documentEntry = formData.get("revised_po_document");
  if (!(documentEntry instanceof File) || documentEntry.size === 0) {
    return jsonError("A revised PO document is required", 400);
  }
  const validationError = validateDocument(documentEntry, { poRevision: true });
  if (validationError) return jsonError(validationError, 400);

  const admin = createAdminClient();
  const { data: purchaseOrder, error: poError } = await admin
    .from("job_purchase_orders")
    .select("id")
    .eq("id", poId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (poError) return jsonError("Unable to validate purchase order", 500);
  if (!purchaseOrder) return jsonError("Purchase order not found", 404);

  const upload = await uploadPurchaseOrderDocument({
    admin,
    orgId: session.org_id,
    purchaseOrderId: poId,
    actorId: session.user.id,
    file: documentEntry,
    documentType: "po_revision",
  });
  if (upload.error || !upload.document) {
    return jsonError("Unable to upload the revised PO document", 500);
  }

  const authenticated = await createSupabaseServerClient();
  const { data: revisionId, error: revisionError } = await authenticated.rpc(
    "create_job_purchase_order_revision",
    {
      p_purchase_order_id: poId,
      p_revision_date: revisionDate,
      p_document_id: upload.document.id,
      p_added_allocations: addedAllocations,
      p_removed_allocation_ids: Array.from(new Set(removedIds)),
      p_internal_remarks: remarks,
      p_allow_customer_override: allowCustomerOverride,
    },
  );

  if (revisionError || !revisionId) {
    await admin.storage
      .from(jobDocumentBuckets.purchaseOrders)
      .remove([upload.document.file_path]);
    await admin.from("job_purchase_order_documents").delete().eq("id", upload.document.id);
    console.error("create_job_purchase_order_revision failed", {
      code: revisionError?.code,
      message: revisionError?.message,
    });
    return jsonError(revisionError?.message ?? "Unable to create PO revision", 409);
  }

  const { data: revision } = await admin
    .from("job_purchase_order_revisions")
    .select("id,revision_number,revised_po_amount,difference_amount,change_percentage")
    .eq("id", revisionId)
    .eq("org_id", session.org_id)
    .single();

  return NextResponse.json({ revision }, { status: 201 });
}
