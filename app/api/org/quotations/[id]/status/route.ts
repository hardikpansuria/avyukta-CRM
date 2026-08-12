import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { logCustomerActivity } from "@/lib/customers/activity";
import { logRevisionAudit } from "@/lib/quotations/revisions";
import { canTransitionQuotationStatus } from "@/lib/quotations/status-transitions";
import { syncCustomerQuotationPricing } from "@/lib/quotations/sync-customer-quotation-pricing";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/status">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "quotations", "edit");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const requestedStatus = (body as Record<string, unknown>)?.status;
  if (typeof requestedStatus !== "string" || !requestedStatus.trim()) {
    return jsonError("Status is required", 400);
  }

  const nextStatus = requestedStatus.trim();
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: existingQuotation, error: existingError } = await admin
    .from("quotations")
    .select("*")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (existingError) return jsonError("Unable to validate quotation", 500);
  if (!existingQuotation) return jsonError("Quotation not found", 404);

  const currentStatus = String(existingQuotation.status ?? "draft");
  if (currentStatus === nextStatus) {
    return NextResponse.json({
      quotation: existingQuotation,
      message: "Quotation status is unchanged",
      job_created: false,
      job: null,
    });
  }

  if (!canTransitionQuotationStatus(currentStatus, nextStatus)) {
    return jsonError(
      `Quotation status cannot change from ${currentStatus} to ${nextStatus}`,
      409,
    );
  }

  if (currentStatus === "draft" && nextStatus === "sent") {
    const syncResult = await syncCustomerQuotationPricing({
      orgId: session.org_id,
      quotationId: id,
      actorId: session.user.id,
      adminClient: admin,
    });

    if (syncResult.error) {
      console.error("Unable to synchronize customer quotation", syncResult.error);
      return jsonError("Unable to synchronize the customer quotation draft", 500);
    }
  }

  const { data: quotation, error: updateError } = await admin
    .from("quotations")
    .update({ status: nextStatus, updated_by: session.user.id })
    .eq("id", id)
    .eq("org_id", session.org_id)
    .eq("status", currentStatus)
    .select("*")
    .maybeSingle();

  if (updateError) {
    if (updateError.code === "23514") return jsonError(updateError.message, 409);
    console.error("Unable to update quotation status", {
      code: updateError.code,
      message: updateError.message,
    });
    return jsonError("Unable to update quotation status", 500);
  }

  if (!quotation) {
    return jsonError(
      "Quotation status changed while this request was being processed. Refresh and try again.",
      409,
    );
  }

  if (nextStatus === "sent") {
    await logCustomerActivity(admin, {
      org_id: session.org_id,
      customer_id: String(quotation.customer_id),
      activity_type: "quote_sent",
      description: `Quotation ${quotation.quotation_number} sent`,
      actor_id: session.user.id,
      linked_record_type: "quotation",
      linked_record_id: id,
      linked_record_number: quotation.quotation_number,
    });
  }

  await logRevisionAudit(admin, quotation, session.user.id, "status_changed", {
    previous_status: currentStatus,
    new_status: nextStatus,
  });

  let operationalJob: {
    id: string;
    job_number?: string | null;
    job_status?: string | null;
  } | null = null;
  const jobWasCreated = currentStatus === "sent" && nextStatus === "accepted";

  if (jobWasCreated && quotation.quotation_series_id) {
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("id,job_number,job_status")
      .eq("org_id", session.org_id)
      .eq("quotation_series_id", quotation.quotation_series_id)
      .maybeSingle();

    if (jobError) {
      console.error("Quotation accepted but job confirmation lookup failed", {
        code: jobError.code,
        message: jobError.message,
      });
    } else {
      operationalJob = job;
    }
  }

  return NextResponse.json({
    quotation,
    message:
      jobWasCreated && operationalJob
        ? "Quotation accepted and Job on the Go created"
        : "Quotation status updated",
    job_created: jobWasCreated && Boolean(operationalJob),
    job: operationalJob,
  });
}
