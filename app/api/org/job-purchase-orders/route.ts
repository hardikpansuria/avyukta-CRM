import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { requireOwnedMutation } from "@/lib/auth/data-scope";
import {
  uploadPurchaseOrderDocument,
  validateDocument,
} from "@/lib/jobs/documents";
import { listPurchaseOrders } from "@/lib/jobs/purchase-orders";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AllocationInput = {
  job_id?: unknown;
  po_amount_before_tax?: unknown;
  difference_acknowledged?: unknown;
  scope_ids?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parsePurchaseOrderId(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.length) {
    return parsePurchaseOrderId(value[0]);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      parsePurchaseOrderId(record.purchase_order_id) ||
      parsePurchaseOrderId(record.id)
    );
  }
  return "";
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "view");
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const poNumber = searchParams.get("po_number")?.trim();
  const customerId = searchParams.get("customer_id")?.trim();
  if (poNumber && customerId) {
    const { data, error } = await createAdminClient()
      .from("job_purchase_orders")
      .select("id,po_number,customer_id,current_revision_number,current_po_total")
      .eq("org_id", session.org_id)
      .eq("customer_id", customerId)
      .eq("po_number", poNumber)
      .maybeSingle();
    if (error) return jsonError("Unable to check the PO number", 500);
    return NextResponse.json({ existing_purchase_order: data ?? null });
  }
  const search = searchParams.get("search")?.trim() ?? "";
  const parsedPage = Number(searchParams.get("page") ?? 1);
  const parsedPageSize = Number(searchParams.get("pageSize") ?? 20);
  const result = await listPurchaseOrders(createAdminClient(), session.org_id, {
    search,
    page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    pageSize:
      Number.isInteger(parsedPageSize) && parsedPageSize > 0
        ? parsedPageSize
        : 20,
  });
  if (result.error) return jsonError("Unable to fetch purchase orders", 500);
  return NextResponse.json({
    purchase_orders: result.purchaseOrders ?? [],
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(
        1,
        Math.ceil((result.total ?? 0) / (result.pageSize ?? 20)),
      ),
    },
    filters: { search },
  });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "purchase_orders", "attach_po");
  if (denied) return denied;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data", 400);
  }

  const poNumber = text(formData.get("po_number"));
  const poReceivedDate = text(formData.get("po_received_date"));
  const internalRemarks = text(formData.get("internal_remarks")) || null;
  const rawAllocations = text(formData.get("allocations"));

  if (!poNumber) return jsonError("Purchase Order Number is required", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(poReceivedDate)) {
    return jsonError("Purchase Order Received Date is required", 400);
  }

  let allocationInput: AllocationInput[];
  try {
    allocationInput = JSON.parse(rawAllocations) as AllocationInput[];
  } catch {
    return jsonError("Allocations are invalid", 400);
  }

  if (!Array.isArray(allocationInput) || allocationInput.length === 0) {
    return jsonError("Select at least one job", 400);
  }

  const allocations = allocationInput.map((allocation) => ({
    job_id:
      typeof allocation.job_id === "string" ? allocation.job_id.trim() : "",
    po_amount_before_tax: Number(allocation.po_amount_before_tax),
    difference_acknowledged:
      allocation.difference_acknowledged === true,
    scope_ids: Array.isArray(allocation.scope_ids)
      ? Array.from(new Set(allocation.scope_ids.filter((value): value is string => typeof value === "string")))
      : [],
  }));

  if (
    allocations.some(
      (allocation) =>
        !allocation.job_id ||
        allocation.scope_ids.length === 0 ||
        !Number.isFinite(allocation.po_amount_before_tax) ||
        allocation.po_amount_before_tax < 0,
    )
  ) {
    return jsonError("Each allocation requires a valid non-negative amount", 400);
  }

  const poPdfEntry = formData.get("po_pdf");
  const poPdf = poPdfEntry instanceof File && poPdfEntry.size ? poPdfEntry : null;
  const supportingFiles = formData
    .getAll("supporting_documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (poPdf) {
    const validationError = validateDocument(poPdf, { pdfOnly: true });
    if (validationError) return jsonError(validationError, 400);
  }
  for (const file of supportingFiles) {
    const validationError = validateDocument(file);
    if (validationError) return jsonError(validationError, 400);
  }

  const admin = createAdminClient();
  const jobIds = Array.from(
    new Set(allocations.map((allocation) => allocation.job_id)),
  );
  if (jobIds.length !== allocations.length) {
    return jsonError("A job can only appear once in the allocation", 400);
  }

  const { data: jobs, error: jobsError } = await admin
    .from("jobs")
    .select("id,customer_id,job_status,latest_accepted_quotation_id,salesperson_id")
    .eq("org_id", session.org_id)
    .in("id", jobIds);

  if (jobsError) return jsonError("Unable to validate jobs", 500);
  if ((jobs ?? []).length !== jobIds.length) {
    return jsonError("One or more jobs were not found", 404);
  }
  if ((jobs ?? []).some((job) => job.job_status !== "po_pending")) {
    return jsonError("Every selected job must be PO Pending", 409);
  }
  const scopeDenied = await requireOwnedMutation(
    session,
    "purchase_orders",
    (jobs ?? []).map((job) => job.salesperson_id),
    "all",
  );
  if (scopeDenied) return scopeDenied;
  if (new Set((jobs ?? []).map((job) => job.customer_id)).size !== 1) {
    return jsonError("Combined jobs must belong to the same customer", 400);
  }

  const customerId = jobs![0].customer_id;
  const { data: duplicate, error: duplicateError } = await admin
    .from("job_purchase_orders")
    .select("id,po_number")
    .eq("org_id", session.org_id)
    .eq("customer_id", customerId)
    .eq("po_number", poNumber)
    .maybeSingle();
  if (duplicateError) return jsonError("Unable to check the PO number", 500);
  if (duplicate) {
    return NextResponse.json(
      {
        error: `${poNumber} already exists for this customer.`,
        code: "PO_EXISTS",
        existing_purchase_order: duplicate,
      },
      { status: 409 },
    );
  }

  const requestedScopeIds = allocations.flatMap((allocation) => allocation.scope_ids);
  const { data: validScopes, error: scopesError } = await admin
    .from("quotation_scopes")
    .select("id,quotation_id")
    .eq("org_id", session.org_id)
    .in("id", requestedScopeIds);
  if (scopesError) return jsonError("Unable to validate Work Order scopes", 500);
  const validScopeQuotation = new Map((validScopes ?? []).map((scope) => [scope.id, scope.quotation_id]));
  const jobsById = new Map((jobs ?? []).map((job) => [job.id, job]));
  if (allocations.some((allocation) => allocation.scope_ids.some((scopeId) =>
    validScopeQuotation.get(scopeId) !== jobsById.get(allocation.job_id)?.latest_accepted_quotation_id,
  ))) {
    return jsonError("Each Work Order scope must belong to its accepted quotation", 400);
  }

  const { data: previousAssignments, error: assignmentsError } = await admin
    .from("job_scope_assignments")
    .select("org_id,job_id,quotation_id,scope_id,assigned_by,assigned_at")
    .eq("org_id", session.org_id)
    .in("job_id", jobIds);
  if (assignmentsError) return jsonError("Unable to prepare Work Order scopes", 500);
  const { error: clearAssignmentsError } = await admin
    .from("job_scope_assignments")
    .delete()
    .eq("org_id", session.org_id)
    .in("job_id", jobIds);
  if (clearAssignmentsError) return jsonError("Unable to update Work Order scopes", 500);
  const replacementAssignments = allocations.flatMap((allocation) =>
    allocation.scope_ids.map((scopeId) => ({
      org_id: session.org_id,
      job_id: allocation.job_id,
      quotation_id: jobsById.get(allocation.job_id)!.latest_accepted_quotation_id,
      scope_id: scopeId,
      assigned_by: session.user.id,
    })),
  );
  const { error: insertAssignmentsError } = await admin.from("job_scope_assignments").insert(replacementAssignments);
  if (insertAssignmentsError) {
    if (previousAssignments?.length) await admin.from("job_scope_assignments").insert(previousAssignments);
    return jsonError("Unable to update Work Order scopes", 500);
  }

  // This must be the cookie-authenticated client: the RPC validates auth.uid().
  const authenticated = await createSupabaseServerClient();
  const { data: rpcResult, error: rpcError } = await authenticated.rpc(
    "create_job_purchase_order",
    {
      p_po_number: poNumber,
      p_po_received_date: poReceivedDate,
      p_internal_remarks: internalRemarks,
      p_allocations: allocations,
    },
  );

  if (rpcError) {
    await admin.from("job_scope_assignments").delete().eq("org_id", session.org_id).in("job_id", jobIds);
    if (previousAssignments?.length) await admin.from("job_scope_assignments").insert(previousAssignments);
    console.error("create_job_purchase_order failed", {
      code: rpcError.code,
      message: rpcError.message,
    });
    return jsonError(rpcError.message || "Unable to create purchase order", 409);
  }

  const purchaseOrderId = parsePurchaseOrderId(rpcResult);
  if (!purchaseOrderId) {
    return jsonError("Purchase order was created but its ID was not returned", 500);
  }

  const { data: purchaseOrder, error: poError } = await admin
    .from("job_purchase_orders")
    .select("id,po_number")
    .eq("id", purchaseOrderId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (poError || !purchaseOrder) {
    return jsonError("Unable to verify the created purchase order", 500);
  }

  const uploadFailures: string[] = [];
  const files = [
    ...(poPdf
      ? [{ file: poPdf, type: "purchase_order" as const }]
      : []),
    ...supportingFiles.map((file) => ({
      file,
      type: "supporting_document" as const,
    })),
  ];

  for (const item of files) {
    const result = await uploadPurchaseOrderDocument({
      admin,
      orgId: session.org_id,
      purchaseOrderId,
      actorId: session.user.id,
      file: item.file,
      documentType: item.type,
    });
    if (result.error) uploadFailures.push(item.file.name);
  }

  const { data: updatedJobs } = await admin
    .from("jobs")
    .select("id,job_number")
    .eq("org_id", session.org_id)
    .in("id", jobIds);

  return NextResponse.json(
    {
      purchase_order_id: purchaseOrderId,
      po_number: purchaseOrder.po_number,
      jobs: updatedJobs ?? [],
      document_warning: uploadFailures.length
        ? `Purchase order created, but ${uploadFailures.length} document upload${
            uploadFailures.length === 1 ? "" : "s"
          } failed. Retry from the PO detail page: ${uploadFailures.join(", ")}`
        : null,
    },
    { status: 201 },
  );
}
