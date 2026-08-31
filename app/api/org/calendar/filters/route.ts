import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { requireOrgPermission } from "@/lib/auth/permissions";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import { calendarJsonError, getActiveCalendarEmployees, listCalendarJobs } from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  const denied = await requireOrgPermission(session, "calendar", "view");
  if (denied) return denied;
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const admin = createAdminClient();
  const [employees, jobs, customers] = await Promise.all([
    getActiveCalendarEmployees(admin, session.org_id),
    listCalendarJobs(admin, session.org_id),
    admin.from("customers").select("id,company_name").eq("org_id", session.org_id).eq("record_status", "active").order("company_name"),
  ]);
  if (employees.error || jobs.error || customers.error) return calendarJsonError("Unable to fetch calendar filters", 500);
  return Response.json({ employees: employees.employees, jobs: jobs.jobs, customers: customers.data ?? [] });
}
