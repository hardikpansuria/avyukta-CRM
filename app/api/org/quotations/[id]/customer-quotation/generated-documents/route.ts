import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

const bucketName = "customer-quotation-pdfs";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/quotations/[id]/customer-quotation/generated-documents">,
) {
  const session = await verifyOrgSession();

  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("id,quotation_series_id")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (quotationError) return jsonError("Unable to validate quotation", 500);
  if (!quotation) return jsonError("Quotation not found", 404);

  const { data: seriesRows } = quotation.quotation_series_id
    ? await admin.from("quotations").select("id").eq("org_id", session.org_id).eq("quotation_series_id", quotation.quotation_series_id)
    : { data: [{ id }] };
  const quotationIds = (seriesRows ?? [{ id }]).map((row) => row.id);
  const { data: documents, error: documentsError } = await admin
    .from("quotation_generated_documents")
    .select("*")
    .eq("org_id", session.org_id)
    .in("quotation_id", quotationIds)
    .order("generated_at", { ascending: false });

  if (documentsError) {
    return jsonError("Unable to fetch generated documents", 500);
  }

  const profileIds = Array.from(
    new Set(
      (documents ?? [])
        .map((document) => document.generated_by as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const { data: profiles } =
    profileIds.length > 0
      ? await admin
          .from("profiles")
          .select("id,full_name,email")
          .in("id", profileIds)
      : { data: [] };
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );
  const enriched = await Promise.all(
    (documents ?? []).map(async (document) => {
      const { data: signedData } = await admin.storage
        .from(bucketName)
        .createSignedUrl(document.file_path, 10 * 60);

      return {
        ...document,
        generated_by_profile:
          profilesById.get(document.generated_by as string) ?? null,
        signed_url: signedData?.signedUrl ?? null,
      };
    }),
  );

  return NextResponse.json({ documents: enriched });
}
