import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  cloneQuotationRevisionData,
  revisionIdFromRpc,
} from "@/lib/quotations/revisions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/revisions">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("quotations")
    .select("id,quotation_series_id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (currentError) return jsonError("Unable to fetch revision history", 500);
  if (!current) return jsonError("Quotation not found", 404);

  const { data: revisions, error } = await admin
    .from("quotations")
    .select("id,quotation_number,quotation_series_id,revision_number,revision_purpose,revision_source_id,revision_created_by,revision_created_at,status,is_locked,created_at,updated_at,customer_id")
    .eq("org_id", session.org_id)
    .eq("quotation_series_id", current.quotation_series_id)
    .order("revision_number", { ascending: true });
  if (error) return jsonError("Unable to fetch revision history", 500);

  const userIds = Array.from(new Set((revisions ?? []).map((row) => row.revision_created_by as string).filter(Boolean)));
  const customerIds = Array.from(new Set((revisions ?? []).map((row) => row.customer_id as string).filter(Boolean)));
  const [{ data: profiles }, { data: customers }] = await Promise.all([
    userIds.length ? admin.from("profiles").select("id,full_name,email").in("id", userIds) : Promise.resolve({ data: [] }),
    customerIds.length ? admin.from("customers").select("id,company_name").eq("org_id", session.org_id).in("id", customerIds) : Promise.resolve({ data: [] }),
  ]);
  const profileMap = new Map((profiles ?? []).map((row) => [row.id, row]));
  const customerMap = new Map((customers ?? []).map((row) => [row.id, row]));
  return NextResponse.json({ revisions: (revisions ?? []).map((row) => ({
    ...row,
    created_by_profile: profileMap.get(row.revision_created_by as string) ?? null,
    customer: customerMap.get(row.customer_id as string) ?? null,
  })) });
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/revisions">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const body = await request.json().catch(() => null) as { purpose?: unknown } | null;
  const purpose = typeof body?.purpose === "string" ? body.purpose.trim() : "";
  if (!purpose) return jsonError("Purpose of revision is required", 400);

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: source, error: sourceError } = await admin
    .from("quotations")
    .select("id,status")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (sourceError) return jsonError("Unable to validate source quotation", 500);
  if (!source) return jsonError("Quotation not found", 404);
  if (source.status !== "sent") return jsonError("Only a sent quotation can be revised", 409);

  const supabase = await createSupabaseServerClient();
  const { data, error: rpcError } = await supabase.rpc("create_quotation_revision", {
    p_source_quotation_id: id,
    p_revision_purpose: purpose,
  });
  const newQuotationId = revisionIdFromRpc(data);
  if (rpcError || !newQuotationId) {
    console.error("Unable to create quotation revision", rpcError);
    return jsonError("Unable to create quotation revision", 500);
  }

  try {
    await cloneQuotationRevisionData(admin, session.org_id, id, newQuotationId, session.user.id);
  } catch (error) {
    console.error("Unable to copy quotation revision data", error);
    return jsonError("The revision was not created because its quotation data or attachments could not be copied safely.", 500);
  }

  return NextResponse.json({ quotation_id: newQuotationId }, { status: 201 });
}
