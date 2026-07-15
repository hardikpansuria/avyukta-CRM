import { NextResponse } from "next/server";

import { verifySuperAdmin } from "@/lib/auth/verify-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateOrganizationBody = {
  status?: unknown;
};

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/super-admin/organizations/[id]">,
) {
  const session = await verifySuperAdmin();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  let body: UpdateOrganizationBody;

  try {
    body = (await request.json()) as UpdateOrganizationBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const status = typeof body.status === "string" ? body.status : "";
  const allowedStatuses = new Set(["active", "paused", "deleted"]);

  if (!allowedStatuses.has(status)) {
    return jsonError("Invalid organization status", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .update({ status })
    .eq("id", id)
    .select("id, name, org_code, status")
    .maybeSingle();

  if (error) {
    return jsonError("Unable to update organization", 500);
  }

  if (!data) {
    return jsonError("Organization not found", 404);
  }

  return NextResponse.json({ organization: data });
}
