import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import { calendarJsonError, checkCalendarConflicts, isEventType, parseInterval, uniqueIds, validateActiveEmployees } from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  let body: Record<string, unknown>;
  try { body = (await request.json()) as Record<string, unknown>; }
  catch { return calendarJsonError("Invalid request body", 400); }
  if (!isEventType(body.event_type)) return calendarJsonError("Invalid event type", 400);
  const employeeIds = uniqueIds(body.employee_ids);
  const interval = parseInterval(body.starts_at, body.ends_at);
  if (interval.error) return calendarJsonError(interval.error, 400);
  const admin = createAdminClient();
  const employees = await validateActiveEmployees(admin, session.org_id, employeeIds);
  if (employees.error) return calendarJsonError("Unable to validate employees", 500);
  if (employees.invalid) return calendarJsonError("Every employee must be active and belong to this organization", 400);
  const result = await checkCalendarConflicts(admin, {
    orgId: session.org_id,
    employeeIds,
    startsAt: interval.value.starts_at,
    endsAt: interval.value.ends_at,
    eventType: body.event_type,
    excludeEventId: typeof body.exclude_event_id === "string" ? body.exclude_event_id : null,
  });
  if (result.error) return calendarJsonError("Unable to check employee availability", 500);
  return Response.json({ conflicts: result.conflicts });
}

