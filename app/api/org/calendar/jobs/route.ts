import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import { calendarJsonError, listCalendarJobs } from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const result = await listCalendarJobs(createAdminClient(), session.org_id);
  if (result.error) return calendarJsonError("Unable to fetch schedulable jobs", 500);
  return Response.json({ jobs: result.jobs });
}

