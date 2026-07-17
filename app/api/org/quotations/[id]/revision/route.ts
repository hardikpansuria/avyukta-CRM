import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { logCustomerActivity } from "@/lib/customers/activity";
import { getQuotationDetail } from "@/lib/quotations/api";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/revision">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  const admin = createAdminClient();
  const detail = await getQuotationDetail(admin, session.org_id, id);

  if (detail.error) {
    return jsonError("Unable to fetch quotation snapshot", 500);
  }

  if (detail.notFound || !detail.quotation) {
    return jsonError("Quotation not found", 404);
  }

  const quotation = detail.quotation as {
    id: string;
    quotation_number?: string | null;
    revision_number?: number | string | null;
    customer_id: string;
  };
  const revisionNumber = Number(quotation.revision_number ?? 0);
  const quotationNumber = quotation.quotation_number ?? "";
  const { data: revision, error: revisionError } = await admin
    .from("quotation_revisions")
    .insert({
      org_id: session.org_id,
      quotation_id: id,
      revision_number: Number.isFinite(revisionNumber) ? revisionNumber : 0,
      quotation_number: quotationNumber,
      snapshot_json: detail,
      created_by: session.user.id,
    })
    .select("*")
    .single();

  if (revisionError || !revision) {
    return jsonError("Unable to create revision snapshot", 500);
  }

  await logCustomerActivity(admin, {
    org_id: session.org_id,
    customer_id: quotation.customer_id,
    activity_type: "quote_revised",
    description: `Quotation ${quotationNumber} revision ${revisionNumber} created`,
    actor_id: session.user.id,
    linked_record_type: "quotation",
    linked_record_id: id,
    linked_record_number: quotationNumber,
    metadata: { revision_number: revisionNumber },
  });

  return NextResponse.json({
    revision,
    message: "Revision snapshot created",
  });
}
