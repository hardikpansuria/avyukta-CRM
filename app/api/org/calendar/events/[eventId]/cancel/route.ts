import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import { calendarEventColumns, calendarJsonError, hydrateCalendarEvents } from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/org/calendar/events/[eventId]/cancel">,
) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const { eventId } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("public_calendar_events")
    .update({
      event_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: session.user.id,
      updated_by: session.user.id,
    })
    .eq("id", eventId)
    .eq("org_id", session.org_id)
    .eq("event_status", "scheduled")
    .select(calendarEventColumns)
    .maybeSingle();
  if (error) return calendarJsonError("Unable to cancel calendar event", 500);
  if (!data) return calendarJsonError("Scheduled calendar event not found", 404);
  const hydrated = await hydrateCalendarEvents(admin, session.org_id, [data]);
  return Response.json({ event: hydrated.events[0] });
}

