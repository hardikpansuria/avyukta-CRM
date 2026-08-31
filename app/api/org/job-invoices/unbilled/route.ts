import { NextResponse } from "next/server";

import { hasOrgPermission, requireOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  listUnbilledJobs,
  type UnbilledJobStatus,
  type UnbilledSort,
} from "@/lib/invoices/unbilled-jobs";
import { createAdminClient } from "@/lib/supabase/admin";

const statuses = new Set<UnbilledJobStatus>([
  "work_in_process",
  "work_completed",
]);
const sorts = new Set<UnbilledSort>([
  "default",
  "remaining",
  "po_amount",
  "job_number",
  "last_invoice_date",
  "completion_date",
]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "invoices", "view");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const requestedStatus = params.get("status")?.trim() ?? "";
  const requestedSort = params.get("sort")?.trim() ?? "default";
  const status = statuses.has(requestedStatus as UnbilledJobStatus)
    ? (requestedStatus as UnbilledJobStatus)
    : "";
  const sort = sorts.has(requestedSort as UnbilledSort)
    ? (requestedSort as UnbilledSort)
    : "default";
  const direction = params.get("direction") === "asc" ? "asc" : "desc";

  const [result, canCreateRequest, canViewJobs] = await Promise.all([
    listUnbilledJobs(createAdminClient(), session.org_id, {
      job: params.get("job")?.trim() ?? "",
      po: params.get("po")?.trim() ?? "",
      customer: params.get("customer")?.trim() ?? "",
      customerId: params.get("customerId")?.trim() ?? "",
      status,
      sort,
      direction,
    }),
    hasOrgPermission(session, "invoice_requests", "create"),
    hasOrgPermission(session, "jobs", "view"),
  ]);
  if (result.error) return jsonError("Unable to fetch unbilled jobs", 500);

  if (result.anomaly_job_ids?.length) {
    console.warn("Overbilled jobs excluded from Unbilled Jobs", {
      orgId: session.org_id,
      jobIds: result.anomaly_job_ids,
    });
  }

  return NextResponse.json({
    jobs: result.jobs ?? [],
    customers: result.customers ?? [],
    summary: result.summary ?? { total_jobs: 0, by_currency: [] },
    permissions: {
      can_create_request: canCreateRequest,
      can_view_jobs: canViewJobs,
    },
  });
}

