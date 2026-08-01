import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  canAccessEmployeeDirectory,
  isEmployeeDirectoryRole,
  isEmployeeDirectoryStatus,
} from "@/lib/employees/access";
import {
  fetchSkillsForEmployees,
  isDuplicateEmailError,
  jsonError,
  normalizedEmail,
  optionalText,
  syncEmployeeSkills,
  uniqueStringIds,
  validateSelectedSkills,
} from "@/lib/employees/server";
import type { DirectoryEmployee } from "@/lib/employees/types";
import { createAdminClient } from "@/lib/supabase/admin";

type EmployeeRow = Omit<DirectoryEmployee, "skills">;
type UpdateEmployeeBody = {
  employee_name?: unknown;
  email?: unknown;
  contact_number?: unknown;
  employee_role?: unknown;
  notes?: unknown;
  employee_status?: unknown;
  skill_ids?: unknown;
};

const employeeColumns =
  "id, employee_name, email, contact_number, employee_role, notes, employee_status, source_type, system_user_id, created_at, updated_at";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/employees/[employeeId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { employeeId } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("employee_directory")
    .select(employeeColumns)
    .eq("id", employeeId)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (error) return jsonError("Unable to fetch employee", 500);
  if (!data) return jsonError("Employee not found", 404);

  const skillsResult = await fetchSkillsForEmployees(admin, session.org_id, [employeeId]);
  if (skillsResult.error) return jsonError("Unable to fetch employee skills", 500);

  return Response.json({
    employee: {
      ...(data as EmployeeRow),
      skills: skillsResult.data.get(employeeId) ?? [],
    },
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/employees/[employeeId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  if (!canAccessEmployeeDirectory(session.role)) {
    return jsonError("Forbidden", 403);
  }

  const { employeeId } = await context.params;
  let body: UpdateEmployeeBody;
  try {
    body = (await request.json()) as UpdateEmployeeBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("employee_directory")
    .select(`${employeeColumns}, updated_by`)
    .eq("id", employeeId)
    .eq("org_id", session.org_id)
    .maybeSingle();
  if (existingError) return jsonError("Unable to fetch employee", 500);
  if (!existing) return jsonError("Employee not found", 404);

  const updates: Record<string, string | null> = {};
  if (body.employee_name !== undefined) {
    const employeeName = optionalText(body.employee_name);
    if (!employeeName) return jsonError("Employee name is required", 400);
    updates.employee_name = employeeName;
  }
  if (body.email !== undefined) {
    const email = normalizedEmail(body.email);
    if (email.error) return jsonError(email.error, 400);
    updates.email = email.value;
  }
  if (body.contact_number !== undefined) {
    updates.contact_number = optionalText(body.contact_number);
  }
  if (body.notes !== undefined) updates.notes = optionalText(body.notes);
  if (body.employee_role !== undefined) {
    if (!isEmployeeDirectoryRole(body.employee_role)) {
      return jsonError("Role must be admin, sales, accounts, or worker", 400);
    }
    updates.employee_role = body.employee_role;
  }
  if (body.employee_status !== undefined) {
    if (!isEmployeeDirectoryStatus(body.employee_status)) {
      return jsonError("Status must be active or inactive", 400);
    }
    updates.employee_status = body.employee_status;
  }

  let selectedSkillIds: string[] | null = null;
  let existingSkillIds: string[] = [];
  if (body.skill_ids !== undefined) {
    selectedSkillIds = uniqueStringIds(body.skill_ids);
    const { data: assignments, error: assignmentsError } = await admin
      .from("employee_directory_skills")
      .select("skill_id")
      .eq("org_id", session.org_id)
      .eq("employee_id", employeeId);
    if (assignmentsError) return jsonError("Unable to validate employee skills", 500);
    existingSkillIds = (assignments ?? []).map((row) => row.skill_id as string);

    const validation = await validateSelectedSkills(
      admin,
      session.org_id,
      selectedSkillIds,
      existingSkillIds,
    );
    if (!validation.valid) {
      return validation.serverError
        ? jsonError("Unable to validate employee skills", 500)
        : jsonError("One or more selected skills are invalid", 400);
    }
  }

  if (Object.keys(updates).length === 0 && selectedSkillIds === null) {
    return jsonError("No employee changes were provided", 400);
  }

  let updated: EmployeeRow = existing as EmployeeRow;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await admin
      .from("employee_directory")
      .update({ ...updates, updated_by: session.user.id })
      .eq("id", employeeId)
      .eq("org_id", session.org_id)
      .select(employeeColumns)
      .maybeSingle();
    if (error) {
      if (isDuplicateEmailError(error)) {
        return jsonError(
          "An employee with this email already exists in the Employee Directory.",
          409,
        );
      }
      return jsonError("Unable to update employee", 500);
    }
    if (!data) return jsonError("Employee not found", 404);
    updated = data as EmployeeRow;
  }

  if (selectedSkillIds !== null) {
    const syncResult = await syncEmployeeSkills(admin, {
      orgId: session.org_id,
      employeeId,
      selectedSkillIds,
      actorId: session.user.id,
    });
    if (syncResult.error) {
      if (Object.keys(updates).length > 0) {
        await admin
          .from("employee_directory")
          .update({
            employee_name: existing.employee_name,
            email: existing.email,
            contact_number: existing.contact_number,
            employee_role: existing.employee_role,
            notes: existing.notes,
            employee_status: existing.employee_status,
            updated_by: existing.updated_by,
          })
          .eq("id", employeeId)
          .eq("org_id", session.org_id);
      }
      return jsonError("Unable to synchronize employee skills", 500);
    }
  }

  const skillsResult = await fetchSkillsForEmployees(admin, session.org_id, [employeeId]);
  if (skillsResult.error) return jsonError("Employee saved, but skills could not be loaded", 500);
  return Response.json({
    employee: {
      ...updated,
      skills: skillsResult.data.get(employeeId) ?? [],
    },
  });
}
