import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessEmployeeDirectory } from "@/lib/employees/access";
import { jsonError } from "@/lib/employees/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  context: RouteContext<
    "/api/org/employees/[employeeId]/skills/[skillId]"
  >,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { employeeId, skillId } = await context.params;
  const admin = createAdminClient();
  const { data: employee, error: employeeError } = await admin
    .from("employee_directory")
    .select("id")
    .eq("id", employeeId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (employeeError) return jsonError("Unable to verify employee", 500);
  if (!employee) return jsonError("Employee not found", 404);

  const { error } = await admin
    .from("employee_directory_skills")
    .delete()
    .eq("org_id", session.org_id)
    .eq("employee_id", employeeId)
    .eq("skill_id", skillId);
  if (error) return jsonError("Unable to remove employee skill", 500);
  return new Response(null, { status: 204 });
}
