import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessEmployeeDirectory } from "@/lib/employees/access";
import { jsonError, optionalText } from "@/lib/employees/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/employee-skills/[skillId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { skillId } = await context.params;
  let body: { skill_name?: unknown; is_active?: unknown };
  try {
    body = (await request.json()) as {
      skill_name?: unknown;
      is_active?: unknown;
    };
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const updates: { skill_name?: string; is_active?: boolean; updated_by: string } = {
    updated_by: session.user.id,
  };
  if (body.skill_name !== undefined) {
    const skillName = optionalText(body.skill_name);
    if (!skillName) return jsonError("Skill name is required", 400);
    if (skillName.length > 100) {
      return jsonError("Skill name must be 100 characters or fewer", 400);
    }
    updates.skill_name = skillName;
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      return jsonError("Skill status must be active or inactive", 400);
    }
    updates.is_active = body.is_active;
  }
  if (updates.skill_name === undefined && updates.is_active === undefined) {
    return jsonError("No skill changes were provided", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_skills")
    .update(updates)
    .eq("id", skillId)
    .eq("org_id", session.org_id)
    .select("id, skill_name, is_active, created_at, updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonError("A skill with this name already exists", 409);
    }
    return jsonError("Unable to update skill", 500);
  }
  if (!data) return jsonError("Skill not found", 404);
  return Response.json({ skill: data });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/employee-skills/[skillId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { skillId } = await context.params;
  const admin = createAdminClient();
  const { data: skill, error: skillError } = await admin
    .from("employee_skills")
    .select("id")
    .eq("id", skillId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (skillError) return jsonError("Unable to verify skill", 500);
  if (!skill) return jsonError("Skill not found", 404);

  const { data: assignments, error: assignmentsError } = await admin
    .from("employee_directory_skills")
    .select("org_id, employee_id, skill_id, assigned_by, assigned_at")
    .eq("org_id", session.org_id)
    .eq("skill_id", skillId);
  if (assignmentsError) return jsonError("Unable to verify skill assignments", 500);

  const { error: removeAssignmentsError } = await admin
    .from("employee_directory_skills")
    .delete()
    .eq("org_id", session.org_id)
    .eq("skill_id", skillId);
  if (removeAssignmentsError) {
    return jsonError("Unable to remove skill assignments", 500);
  }

  const { error: deleteError } = await admin
    .from("employee_skills")
    .delete()
    .eq("id", skillId)
    .eq("org_id", session.org_id);
  if (deleteError) {
    if ((assignments ?? []).length > 0) {
      await admin.from("employee_directory_skills").insert(assignments ?? []);
    }
    return jsonError("Unable to delete skill", 500);
  }
  return new Response(null, { status: 204 });
}
