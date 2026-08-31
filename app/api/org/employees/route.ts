import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  isEmployeeDirectoryRole,
  isEmployeeDirectoryStatus,
} from "@/lib/employees/access";
import {
  fetchSkillsForEmployees,
  isDuplicateEmailError,
  jsonError,
  normalizedEmail,
  optionalText,
  uniqueStringIds,
  validateSelectedSkills,
} from "@/lib/employees/server";
import type { DirectoryEmployee } from "@/lib/employees/types";
import { createAdminClient } from "@/lib/supabase/admin";

type EmployeeRow = Omit<DirectoryEmployee, "skills">;

type CreateEmployeeBody = {
  employee_name?: unknown;
  email?: unknown;
  contact_number?: unknown;
  employee_role?: unknown;
  notes?: unknown;
  employee_status?: unknown;
  skill_ids?: unknown;
};

function positiveInteger(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safeSearchValue(value: string) {
  return value
    .replace(/[(),"]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
    .trim();
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "employees", "view");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const search = safeSearchValue(params.get("search")?.trim() ?? "");
  const role = params.get("role")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const sort = params.get("sort") === "created_at" ? "created_at" : "employee_name";
  const direction = params.get("direction") === "desc" ? "desc" : "asc";
  const page = positiveInteger(params.get("page"), 1);
  const pageSize = Math.min(positiveInteger(params.get("pageSize"), 20), 100);
  const start = (page - 1) * pageSize;

  if (role && !isEmployeeDirectoryRole(role)) {
    return jsonError("Invalid employee role filter", 400);
  }
  if (status && !isEmployeeDirectoryStatus(status)) {
    return jsonError("Invalid employee status filter", 400);
  }

  const admin = createAdminClient();
  let query = admin
    .from("employee_directory")
    .select(
      "id, employee_name, email, contact_number, employee_role, notes, employee_status, source_type, system_user_id, created_at, updated_at",
      { count: "exact" },
    )
    .eq("org_id", session.org_id);

  if (search) {
    query = query.or(
      `employee_name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }
  if (role) query = query.eq("employee_role", role);
  if (status) query = query.eq("employee_status", status);

  const { data, error, count } = await query
    .order(sort, { ascending: direction === "asc", nullsFirst: false })
    .order("id", { ascending: true })
    .range(start, start + pageSize - 1);

  if (error) {
    console.error("Unable to fetch employee directory", {
      code: error.code,
      message: error.message,
    });
    return jsonError("Unable to fetch employees", 500);
  }

  const rows = (data ?? []) as EmployeeRow[];
  const skillsResult = await fetchSkillsForEmployees(
    admin,
    session.org_id,
    rows.map((row) => row.id),
  );
  if (skillsResult.error) return jsonError("Unable to fetch employee skills", 500);

  const total = count ?? 0;
  return Response.json({
    employees: rows.map((row) => ({
      ...row,
      skills: skillsResult.data.get(row.id) ?? [],
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return jsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "employees", "create");
  if (denied) return denied;

  let body: CreateEmployeeBody;
  try {
    body = (await request.json()) as CreateEmployeeBody;
  } catch {
    return jsonError("Invalid request body", 400);
  }

  const employeeName = optionalText(body.employee_name);
  const email = normalizedEmail(body.email);
  const employeeRole = body.employee_role ?? "worker";
  const employeeStatus = body.employee_status ?? "active";
  const skillIds = uniqueStringIds(body.skill_ids);

  if (!employeeName) return jsonError("Employee name is required", 400);
  if (email.error) return jsonError(email.error, 400);
  if (!isEmployeeDirectoryRole(employeeRole)) {
    return jsonError("Role must be admin, sales, accounts, or worker", 400);
  }
  if (!isEmployeeDirectoryStatus(employeeStatus)) {
    return jsonError("Status must be active or inactive", 400);
  }

  const admin = createAdminClient();
  const skillsValidation = await validateSelectedSkills(
    admin,
    session.org_id,
    skillIds,
  );
  if (!skillsValidation.valid) {
    return skillsValidation.serverError
      ? jsonError("Unable to validate employee skills", 500)
      : jsonError("One or more selected skills are invalid or inactive", 400);
  }

  const { data: employee, error: employeeError } = await admin
    .from("employee_directory")
    .insert({
      org_id: session.org_id,
      employee_name: employeeName,
      email: email.value,
      contact_number: optionalText(body.contact_number),
      employee_role: employeeRole,
      notes: optionalText(body.notes),
      employee_status: employeeStatus,
      source_type: "manual",
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(
      "id, employee_name, email, contact_number, employee_role, notes, employee_status, source_type, system_user_id, created_at, updated_at",
    )
    .single();

  if (employeeError) {
    if (isDuplicateEmailError(employeeError)) {
      return jsonError(
        "An employee with this email already exists in the Employee Directory.",
        409,
      );
    }
    return jsonError("Unable to create employee", 500);
  }

  if (skillIds.length > 0) {
    const { error: assignmentError } = await admin
      .from("employee_directory_skills")
      .insert(
        skillIds.map((skillId) => ({
          org_id: session.org_id,
          employee_id: employee.id,
          skill_id: skillId,
          assigned_by: session.user.id,
        })),
      );

    if (assignmentError) {
      await admin
        .from("employee_directory")
        .delete()
        .eq("id", employee.id)
        .eq("org_id", session.org_id)
        .eq("source_type", "manual");
      return jsonError("Unable to assign employee skills", 500);
    }
  }

  return Response.json(
    {
      employee: {
        ...(employee as EmployeeRow),
        skills: [],
      },
    },
    { status: 201 },
  );
}
