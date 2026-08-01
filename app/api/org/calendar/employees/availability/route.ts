import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import { calendarJsonError, checkCalendarConflicts, getActiveCalendarEmployees, isEventType, parseInterval } from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const params = new URL(request.url).searchParams;
  const eventType = params.get("eventType") ?? "job_site_assignment";
  if (!isEventType(eventType)) return calendarJsonError("Invalid event type", 400);
  const interval = parseInterval(params.get("start"), params.get("end"));
  if (interval.error) return calendarJsonError(interval.error, 400);
  const admin = createAdminClient();
  const employeeResult = await getActiveCalendarEmployees(admin, session.org_id);
  if (employeeResult.error) return calendarJsonError("Unable to fetch employees", 500);
  const result = await checkCalendarConflicts(admin, {
    orgId: session.org_id,
    employeeIds: employeeResult.employees.map((employee) => employee.id),
    startsAt: interval.value.starts_at,
    endsAt: interval.value.ends_at,
    eventType,
    excludeEventId: params.get("excludeEventId"),
  });
  if (result.error) return calendarJsonError("Unable to check availability", 500);
  const byEmployee = new Map<string, typeof result.conflicts>();
  result.conflicts.forEach((conflict) => byEmployee.set(conflict.employee_id, [...(byEmployee.get(conflict.employee_id) ?? []), conflict]));
  return Response.json({
    employees: employeeResult.employees.map((employee) => ({
      ...employee,
      conflicts: byEmployee.get(employee.id) ?? [],
      availability: byEmployee.get(employee.id)?.some((item) => item.conflict_level === "hard_conflict")
        ? "unavailable"
        : byEmployee.has(employee.id) ? "warning" : "available",
    })),
  });
}

