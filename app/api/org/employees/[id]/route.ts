import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

type UpdateEmployeeBody = {
  role?: unknown;
  status?: unknown;
};

const employeeRoles = new Set(["accountant", "sales"]);
const employeeStatuses = new Set(["active", "inactive"]);

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/employees/[id]">,
) {
  const session = await verifyOrgSession();

  if (!session) {
    return jsonError("Unauthorized", 401);
  }

  if (session.role !== "admin") {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  let body: UpdateEmployeeBody;

  try {
    body = (await request.json()) as UpdateEmployeeBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const updates: { role?: string; status?: string } = {};

  if (body.role !== undefined) {
    if (typeof body.role !== "string" || !employeeRoles.has(body.role)) {
      return jsonError("Role must be accountant or sales", 400);
    }

    updates.role = body.role;
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !employeeStatuses.has(body.status)
    ) {
      return jsonError("Status must be active or inactive", 400);
    }

    updates.status = body.status;
  }

  if (!updates.role && !updates.status) {
    return jsonError("Role or status is required", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("org_members")
    .update(updates)
    .eq("id", id)
    .eq("org_id", session.org_id)
    .select("id, role, status")
    .maybeSingle();

  if (error) {
    return jsonError("Unable to update employee", 500);
  }

  if (!data) {
    return jsonError("Employee not found", 404);
  }

  return NextResponse.json({
    employee: {
      id: data.id,
      role: data.role,
      status: data.status,
    },
  });
}
