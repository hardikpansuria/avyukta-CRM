import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { listJobs } from "@/lib/jobs/data";
import { createAdminClient } from "@/lib/supabase/admin";

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = positiveInteger(searchParams.get("page"), 1);
  const pageSize = positiveInteger(searchParams.get("pageSize"), 20);
  const customerId = searchParams.get("customerId")?.trim() || undefined;

  const result = await listJobs(createAdminClient(), session.org_id, {
    status: "po_pending",
    search,
    page,
    pageSize,
    customerId,
  });

  if (result.error) {
    console.error("Unable to fetch PO pending jobs", {
      code: result.error.code,
      message: result.error.message,
    });
    return jsonError("Unable to fetch PO pending jobs", 500);
  }

  return NextResponse.json({
    jobs: result.jobs,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    },
    filters: { search, customerId: customerId ?? "" },
  });
}

