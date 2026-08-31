import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { canAccessEmployeeDirectory } from "@/lib/employees/access";
import {
  jsonError,
  uniqueStringIds,
  validateSelectedSkills,
} from "@/lib/employees/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: RouteContext<"/api/org/employees/[employeeId]/skills">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "employees", "edit");
  if (denied) return denied;
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { employeeId } = await context.params;
  let body: { skill_ids?: unknown };
  try {
    body = (await request.json()) as { skill_ids?: unknown };
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const skillIds = uniqueStringIds(body.skill_ids);
  if (skillIds.length === 0) return jsonError("Select at least one skill", 400);

  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employee_directory")
    .select("id")
    .eq("id", employeeId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (employeeError) return jsonError("Unable to verify employee", 500);
  if (!employee) return jsonError("Employee not found", 404);

  const validation = await validateSelectedSkills(
    admin,
    session.org_id,
    skillIds,
  );
  if (!validation.valid) {
    return validation.serverError
      ? jsonError("Unable to validate skills", 500)
      : jsonError("One or more selected skills are invalid or inactive", 400);
  }

  const { error } = await admin.from("employee_directory_skills").upsert(
    skillIds.map((skillId) => ({
      org_id: session.org_id,
      employee_id: employeeId,
      skill_id: skillId,
      assigned_by: session.user.id,
    })),
    { onConflict: "org_id,employee_id,skill_id", ignoreDuplicates: true },
  );
  if (error) return jsonError("Unable to assign employee skills", 500);
  return Response.json({ message: "Skills assigned" }, { status: 201 });
}
