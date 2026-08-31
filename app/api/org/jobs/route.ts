import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { listJobs } from "@/lib/jobs/data";
import type { JobStatus } from "@/lib/jobs/types";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = new Set<JobStatus>([
  "po_pending",
  "work_in_process",
  "work_completed",
]);

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requireOrgPermission(session, "jobs", "view");
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const statusValue = searchParams.get("status")?.trim() ?? "";
  const pageValue = Number(searchParams.get("page") ?? 1);
  const pageSizeValue = Number(searchParams.get("pageSize") ?? 20);
  const result = await listJobs(createAdminClient(), session.org_id, {
    status: statuses.has(statusValue as JobStatus)
      ? (statusValue as JobStatus)
      : undefined,
    search: searchParams.get("search")?.trim() ?? "",
    customerId: searchParams.get("customer_id")?.trim() || undefined,
    completionFrom: searchParams.get("completion_from")?.trim() || undefined,
    completionTo: searchParams.get("completion_to")?.trim() || undefined,
    customerSearch: searchParams.get("customer")?.trim() || undefined,
    salespersonSearch: searchParams.get("salesperson")?.trim() || undefined,
    jobNumber: searchParams.get("job_number")?.trim() || undefined,
    quotationNumber: searchParams.get("quotation_number")?.trim() || undefined,
    poNumber: searchParams.get("po_number")?.trim() || undefined,
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    pageSize:
      Number.isInteger(pageSizeValue) && pageSizeValue > 0 ? pageSizeValue : 20,
  });
  if (result.error) {
    return NextResponse.json(
      { error: "Unable to fetch jobs" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    jobs: result.jobs,
    pagination: {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / (result.pageSize ?? 20))),
    },
  });
}
