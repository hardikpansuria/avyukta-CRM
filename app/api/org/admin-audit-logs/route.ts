import { NextResponse } from "next/server";

import { authorizeOrgRequest } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await authorizeOrgRequest("settings", "manage");
  if ("response" in auth) return auth.response;
  if (auth.session.role !== "admin") {
    return NextResponse.json(
      { error: "Only administrators can view settings logs." },
      { status: 403 },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 50;
  const start = (page - 1) * pageSize;
  const admin = createAdminClient();
  const { data, error, count } = await admin
    .from("admin_audit_logs")
    .select(
      "id,actor_name,actor_email,action_type,module_key,target_type,target_id,target_label,summary,changes,created_at",
      { count: "exact" },
    )
    .eq("org_id", auth.session.org_id)
    .order("created_at", { ascending: false })
    .range(start, start + pageSize - 1);

  if (error) {
    return NextResponse.json(
      { error: "Unable to load administrator logs." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    logs: data ?? [],
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    },
  });
}
