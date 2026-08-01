import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";

import { CalendarClient } from "./calendar-client";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    date?: string;
    rangeStart?: string;
    rangeEnd?: string;
  }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!canAccessPublicCalendar(session.role)) redirect("/dashboard");
  const params = await searchParams;
  const view = ["month", "week", "day"].includes(params.view ?? "")
    ? params.view!
    : "month";
  const parsedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
    ? params.date
    : new Date().toISOString().slice(0, 10);
  const rangeStart = params.rangeStart && /^\d{4}-\d{2}-\d{2}$/.test(params.rangeStart)
    ? params.rangeStart
    : "";
  const rangeEnd = params.rangeEnd && /^\d{4}-\d{2}-\d{2}$/.test(params.rangeEnd)
    ? params.rangeEnd
    : "";
  return (
    <CalendarClient
      initialDate={parsedDate}
      initialRangeEnd={rangeEnd}
      initialRangeStart={rangeStart}
      initialView={view}
    />
  );
}
