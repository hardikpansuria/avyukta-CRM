import { NextResponse } from "next/server";

import { verifySuperAdmin } from "@/lib/auth/verify-super-admin";
import {
  buildLegalAcceptanceReport,
  type LegalReportEvidence,
  type LegalReportMember,
  type LegalReportOrganization,
  type LegalReportProfile,
} from "@/lib/legal/acceptance-report";
import { getLegalSiteConfiguration } from "@/lib/legal/config";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

type QueryError = { message: string };

async function collectAll<T>(
  loadPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: QueryError | null }>,
) {
  const records: T[] = [];

  while (true) {
    const from = records.length;
    const { data, error } = await loadPage(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = data ?? [];
    records.push(...page);

    if (page.length < PAGE_SIZE) {
      return records;
    }
  }
}

export async function GET() {
  const session = await verifySuperAdmin();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getLegalSiteConfiguration().ready) {
    return NextResponse.json(
      { error: "Legal configuration is not approved" },
      { status: 503 },
    );
  }

  const admin = createAdminClient();

  try {
    const [organizations, members, profiles, evidence] = await Promise.all([
      collectAll<LegalReportOrganization>((from, to) =>
        admin
          .from("organizations")
          .select("id, name, org_code, status")
          .order("name", { ascending: true })
          .range(from, to),
      ),
      collectAll<LegalReportMember>((from, to) =>
        admin
          .from("org_members")
          .select("user_id, org_id, role, status")
          .order("created_at", { ascending: true })
          .range(from, to),
      ),
      collectAll<LegalReportProfile>((from, to) =>
        admin
          .from("profiles")
          .select("id, email, full_name")
          .order("created_at", { ascending: true })
          .range(from, to),
      ),
      collectAll<LegalReportEvidence>((from, to) =>
        admin
          .from("legal_acceptances")
          .select(
            "user_id, organization_id, document_key, document_version, content_hash, action_type, accepted_at, acceptance_source",
          )
          .order("accepted_at", { ascending: true })
          .range(from, to),
      ),
    ]);
    const report = buildLegalAcceptanceReport({
      organizations,
      members,
      profiles,
      evidence,
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Unable to build legal acceptance report", error);
    return NextResponse.json(
      { error: "Unable to load legal acceptance report" },
      { status: 500 },
    );
  }
}
