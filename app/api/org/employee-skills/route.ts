import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { canAccessEmployeeDirectory } from "@/lib/employees/access";
import { jsonError, optionalText } from "@/lib/employees/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "employees", "view");
  if (denied) return denied;
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const includeInactive =
    new URL(request.url).searchParams.get("include_inactive") === "1";
  const admin = createAdminClient();
  let query = admin
    .from("employee_skills")
    .select("id, skill_name, is_active, created_at, updated_at")
    .eq("org_id", session.org_id)
    .order("skill_name", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) return jsonError("Unable to fetch skills", 500);
  return Response.json({ skills: data ?? [] });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "employees", "create");
  if (denied) return denied;
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  let body: { skill_name?: unknown };
  try {
    body = (await request.json()) as { skill_name?: unknown };
  } catch {
    return jsonError("Invalid request body", 400);
  }
  const skillName = optionalText(body.skill_name);
  if (!skillName) return jsonError("Skill name is required", 400);
  if (skillName.length > 100) {
    return jsonError("Skill name must be 100 characters or fewer", 400);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_skills")
    .insert({
      org_id: session.org_id,
      skill_name: skillName,
      is_active: true,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select("id, skill_name, is_active, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("A skill with this name already exists", 409);
    }
    return jsonError("Unable to add skill", 500);
  }
  return Response.json({ skill: data }, { status: 201 });
}
