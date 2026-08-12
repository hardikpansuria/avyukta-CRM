import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import {
  calendarEventColumns,
  calendarJsonError,
  hydrateCalendarEvents,
  isCalendarConflictDatabaseError,
  isEventStatus,
  isEventType,
  listCalendarEvents,
  prepareCalendarEvent,
  type CalendarEventBody,
} from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

function isoParam(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "calendar", "view");
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const start = isoParam(params.get("start"));
  const end = isoParam(params.get("end"));
  if (!start || !end || end <= start) {
    return calendarJsonError("A valid visible start and end range is required", 400);
  }
  const eventType = params.get("eventType");
  const status = params.get("status");
  if (eventType && !isEventType(eventType)) return calendarJsonError("Invalid event type", 400);
  if (status && status !== "all" && !isEventStatus(status)) {
    return calendarJsonError("Invalid event status", 400);
  }

  const result = await listCalendarEvents(createAdminClient(), session.org_id, {
    start,
    end,
    employeeId: params.get("employeeId"),
    customerId: params.get("customerId"),
    project: params.get("project")?.trim(),
    jobNumber: params.get("jobNumber")?.trim(),
    poNumber: params.get("poNumber")?.trim(),
    eventType: eventType && isEventType(eventType) ? eventType : null,
    status:
      status === "all" || isEventStatus(status)
        ? status
        : "scheduled",
  });
  if (result.error) {
    console.error("Unable to list calendar events", { code: result.error.code, message: result.error.message });
    return calendarJsonError("Unable to fetch calendar events", 500);
  }
  return Response.json({ events: result.events, range: { start, end } });
}

export async function POST(request: Request) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "calendar", "create");
  if (denied) return denied;
  let body: CalendarEventBody;
  try {
    body = (await request.json()) as CalendarEventBody;
  } catch {
    return calendarJsonError("Invalid request body", 400);
  }

  const admin = createAdminClient();
  const prepared = await prepareCalendarEvent(admin, session.org_id, body);
  if (!prepared.event) {
    return calendarJsonError(prepared.error, prepared.status, {
      conflicts: prepared.conflicts ?? [],
      requires_confirmation: prepared.requires_confirmation ?? false,
    });
  }

  const eventId = crypto.randomUUID();
  const { data: event, error: eventError } = await admin
    .from("public_calendar_events")
    .insert({
      id: eventId,
      org_id: session.org_id,
      ...prepared.event,
      created_by: session.user.id,
      updated_by: session.user.id,
    })
    .select(calendarEventColumns)
    .single();
  if (eventError || !event) {
    if (eventError && isCalendarConflictDatabaseError(eventError)) {
      return calendarJsonError("This schedule conflicts with an existing employee event", 409);
    }
    return calendarJsonError("Unable to create calendar event", 500);
  }

  if (prepared.employeeIds.length) {
    const { error: participantError } = await admin
      .from("public_calendar_event_participants")
      .insert(
        prepared.employeeIds.map((employeeId) => ({
          org_id: session.org_id,
          event_id: eventId,
          employee_id: employeeId,
          participation_required: prepared.participationRequired,
          added_by: session.user.id,
        })),
      );
    if (participantError) {
      const { error: cleanupError } = await admin
        .from("public_calendar_events")
        .delete()
        .eq("id", eventId)
        .eq("org_id", session.org_id);
      if (cleanupError) console.error("Calendar create compensation failed", cleanupError);
      if (isCalendarConflictDatabaseError(participantError)) {
        return calendarJsonError("This schedule conflicts with an existing employee event", 409);
      }
      return calendarJsonError("Unable to assign event participants", 500);
    }
  }

  const hydrated = await hydrateCalendarEvents(admin, session.org_id, [event]);
  return Response.json({ event: hydrated.events[0], warnings: prepared.warnings }, { status: 201 });
}
