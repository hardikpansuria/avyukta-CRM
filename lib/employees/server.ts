import type { SupabaseClient } from "@supabase/supabase-js";

import type { EmployeeSkill } from "./types";

type AssignmentRow = {
  employee_id: string;
  skill_id: string;
};

type SkillRow = EmployeeSkill & { org_id?: string };

export function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export function optionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizedEmail(value: unknown) {
  const email = optionalText(value)?.toLowerCase() ?? null;
  if (!email) return { value: null };

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return valid
    ? { value: email }
    : { value: null, error: "Enter a valid email address" };
}

export function uniqueStringIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string")),
  );
}

export function isDuplicateEmailError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" &&
    (error.message?.toLowerCase().includes("email") ?? false)
  );
}

export async function fetchSkillsForEmployees(
  admin: SupabaseClient,
  orgId: string,
  employeeIds: string[],
) {
  const result = new Map<string, EmployeeSkill[]>();
  employeeIds.forEach((id) => result.set(id, []));
  if (employeeIds.length === 0) return { data: result, error: null };

  const { data: assignments, error: assignmentsError } = await admin
    .from("employee_directory_skills")
    .select("employee_id, skill_id")
    .eq("org_id", orgId)
    .in("employee_id", employeeIds);

  if (assignmentsError) return { data: result, error: assignmentsError };

  const assignmentRows = (assignments ?? []) as AssignmentRow[];
  const skillIds = Array.from(new Set(assignmentRows.map((row) => row.skill_id)));
  if (skillIds.length === 0) return { data: result, error: null };

  const { data: skills, error: skillsError } = await admin
    .from("employee_skills")
    .select("id, skill_name, is_active")
    .eq("org_id", orgId)
    .in("id", skillIds);

  if (skillsError) return { data: result, error: skillsError };

  const skillsById = new Map(
    ((skills ?? []) as SkillRow[]).map((skill) => [skill.id, skill]),
  );
  assignmentRows.forEach((assignment) => {
    const skill = skillsById.get(assignment.skill_id);
    if (skill) result.get(assignment.employee_id)?.push(skill);
  });
  result.forEach((employeeSkills) =>
    employeeSkills.sort((a, b) => a.skill_name.localeCompare(b.skill_name)),
  );
  return { data: result, error: null };
}

export async function validateSelectedSkills(
  admin: SupabaseClient,
  orgId: string,
  skillIds: string[],
  allowedInactiveIds: string[] = [],
) {
  if (skillIds.length === 0) return { valid: true } as const;

  const { data, error } = await admin
    .from("employee_skills")
    .select("id, is_active")
    .eq("org_id", orgId)
    .in("id", skillIds);

  if (error) return { valid: false, serverError: true } as const;
  const rows = (data ?? []) as Array<{ id: string; is_active: boolean }>;
  const allowedInactive = new Set(allowedInactiveIds);
  const validIds = new Set(
    rows
      .filter((row) => row.is_active || allowedInactive.has(row.id))
      .map((row) => row.id),
  );
  return validIds.size === skillIds.length
    ? ({ valid: true } as const)
    : ({ valid: false, serverError: false } as const);
}

export async function syncEmployeeSkills(
  admin: SupabaseClient,
  options: {
    orgId: string;
    employeeId: string;
    selectedSkillIds: string[];
    actorId: string;
  },
) {
  const { data, error } = await admin
    .from("employee_directory_skills")
    .select("skill_id")
    .eq("org_id", options.orgId)
    .eq("employee_id", options.employeeId);
  if (error) return { error };

  const existing = new Set(
    ((data ?? []) as Array<{ skill_id: string }>).map((row) => row.skill_id),
  );
  const selected = new Set(options.selectedSkillIds);
  const added = options.selectedSkillIds.filter((id) => !existing.has(id));
  const removed = Array.from(existing).filter((id) => !selected.has(id));

  if (added.length > 0) {
    const { error: insertError } = await admin
      .from("employee_directory_skills")
      .insert(
        added.map((skillId) => ({
          org_id: options.orgId,
          employee_id: options.employeeId,
          skill_id: skillId,
          assigned_by: options.actorId,
        })),
      );
    if (insertError) return { error: insertError };
  }

  if (removed.length > 0) {
    const { error: deleteError } = await admin
      .from("employee_directory_skills")
      .delete()
      .eq("org_id", options.orgId)
      .eq("employee_id", options.employeeId)
      .in("skill_id", removed);

    if (deleteError) {
      if (added.length > 0) {
        await admin
          .from("employee_directory_skills")
          .delete()
          .eq("org_id", options.orgId)
          .eq("employee_id", options.employeeId)
          .in("skill_id", added);
      }
      return { error: deleteError };
    }
  }

  return { error: null };
}
