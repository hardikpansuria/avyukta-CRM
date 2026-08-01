"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { CalendarApi, DatesSetArg, EventClickArg, EventContentArg, DateSelectArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { CalendarDays, CheckCircle, ChevronLeft, ChevronRight, CirclePlus, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/types";

import { EventFormDialog, type CalendarFilters } from "./event-form-dialog";
import { EventDetailDialog } from "./event-detail-dialog";

type ViewName = "month" | "week" | "day";

const calendarViews: Record<ViewName, string> = {
  month: "dayGridMonth",
  week: "timeGridWeek",
  day: "timeGridDay",
};

type QueryFilters = {
  employeeId: string;
  eventType: string;
  status: string;
  dateFrom: string;
  dateTo: string;
};

const emptyQueryFilters: QueryFilters = {
  employeeId: "",
  eventType: "",
  status: "scheduled",
  dateFrom: "",
  dateTo: "",
};

const typeMeta: Record<CalendarEventType, { label: string; marker: string; className: string }> = {
  employee_holiday: { label: "Employee Holiday", marker: "H", className: "calendar-event-holiday" },
  job_site_assignment: { label: "Job Site Assignment", marker: "J", className: "calendar-event-job" },
  company_event: { label: "Company Event", marker: "C", className: "calendar-event-company" },
};

function urlDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localBoundary(value: string, addDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day + (addDay ? 1 : 0), 0, 0, 0, 0).toISOString();
}

export function CalendarClient({
  initialDate,
  initialRangeEnd,
  initialRangeStart,
  initialView,
}: {
  initialDate: string;
  initialRangeEnd: string;
  initialRangeStart: string;
  initialView: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<ViewName>(initialView as ViewName);
  const [title, setTitle] = useState("Calendar");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CalendarFilters>({ employees: [], jobs: [], customers: [] });
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date; allDay: boolean } | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error">("success");
  const [queryFilters, setQueryFilters] = useState<QueryFilters>(() => ({
    ...emptyQueryFilters,
    dateFrom: initialRangeStart,
    dateTo: initialRangeEnd,
  }));
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const syncUrl = useCallback((
    api: CalendarApi,
    selectedView: ViewName,
    selectedFilters = queryFilters,
  ) => {
    const params = new URLSearchParams({ view: selectedView, date: urlDate(api.getDate()) });
    if (selectedFilters.dateFrom) params.set("rangeStart", selectedFilters.dateFrom);
    if (selectedFilters.dateTo) params.set("rangeEnd", selectedFilters.dateTo);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, queryFilters, router]);

  const loadEvents = useCallback(async (visible: { start: string; end: string }, signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const requestStart = queryFilters.dateFrom
      ? localBoundary(queryFilters.dateFrom)
      : visible.start;
    const requestEnd = queryFilters.dateTo
      ? localBoundary(queryFilters.dateTo, true)
      : visible.end;
    if (requestEnd <= requestStart) {
      setEvents([]);
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ start: requestStart, end: requestEnd });
    Object.entries(queryFilters).forEach(([key, value]) => {
      if (value && key !== "dateFrom" && key !== "dateTo") params.set(key, value);
    });
    try {
      const response = await fetch(`/api/org/calendar/events?${params.toString()}`, { signal, cache: "no-store" });
      const payload = await response.json() as { events?: CalendarEvent[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to fetch calendar events");
      setEvents(payload.events ?? []);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "Unable to fetch calendar events");
    } finally {
      setLoading(false);
    }
  }, [queryFilters]);

  useEffect(() => {
    if (!range) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadEvents(range, controller.signal), 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadEvents, range]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/org/calendar/filters", { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as CalendarFilters & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load calendar options");
        setFilters(payload);
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError(requestError instanceof Error ? requestError.message : "Unable to load calendar options");
        }
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const api = calendarRef.current?.getApi();
      if (!api) return;
      api.changeView(view === "month" ? "listMonth" : view === "week" ? "listWeek" : "listDay");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const eventSource = useMemo(() => events.map((event) => ({
    id: event.id,
    title: event.title,
    start: event.starts_at,
    end: event.ends_at,
    allDay: event.all_day,
    editable: event.event_status === "scheduled",
    classNames: [typeMeta[event.event_type].className, event.event_status === "cancelled" ? "calendar-event-cancelled" : ""],
    extendedProps: { calendarEvent: event },
  })), [events]);

  function datesSet(info: DatesSetArg) {
    setTitle(info.view.title);
    setRange({ start: info.start.toISOString(), end: info.end.toISOString() });
  }

  function changeView(next: ViewName) {
    setView(next);
    const api = calendarRef.current?.getApi();
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    api?.changeView(mobile ? (next === "month" ? "listMonth" : next === "week" ? "listWeek" : "listDay") : calendarViews[next]);
    if (api) syncUrl(api, next);
  }

  function navigate(action: "prev" | "today" | "next") {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api[action]();
    syncUrl(api, view);
  }

  function openCreate(selected: typeof selection = null) {
    setEditingEvent(null);
    setSelection(selected);
    setFormOpen(true);
  }

  function selectSlot(info: DateSelectArg) {
    openCreate({ start: info.start, end: info.end, allDay: info.allDay });
    calendarRef.current?.getApi().unselect();
  }

  function openEvent(info: EventClickArg) {
    const event = info.event.extendedProps.calendarEvent as CalendarEvent;
    setDetailEventId(event.id);
    setDetailOpen(true);
  }

  function saved(savedEvent: CalendarEvent, message: string) {
    setEvents((current) => {
      const exists = current.some((item) => item.id === savedEvent.id);
      return exists ? current.map((item) => item.id === savedEvent.id ? savedEvent : item) : [...current, savedEvent];
    });
    setNotice(message);
    setNoticeTone("success");
    setFormOpen(false);
    setDetailOpen(false);
  }

  function editFromDetail(event: CalendarEvent) {
    setEditingEvent(event);
    setSelection(null);
    setDetailOpen(false);
    setFormOpen(true);
  }

  function deleted(eventId: string) {
    setEvents((current) => current.filter((event) => event.id !== eventId));
    setDetailOpen(false);
    setNotice("Calendar event deleted");
    setNoticeTone("success");
  }

  async function reschedule(info: EventDropArg | EventResizeDoneArg) {
    const current = info.event.extendedProps.calendarEvent as CalendarEvent;
    const start = info.event.start;
    let end = info.event.end;
    if (!start) { info.revert(); return; }
    if (!end && info.event.allDay) end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    if (!end) { info.revert(); return; }
    try {
      const response = await fetch(`/api/org/calendar/events/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starts_at: start.toISOString(), ends_at: end.toISOString() }),
      });
      const payload = await response.json() as { event?: CalendarEvent; error?: string; conflicts?: Array<{ conflict_message: string }> };
      if (!response.ok || !payload.event) throw new Error(payload.conflicts?.[0]?.conflict_message || payload.error || "Unable to reschedule event");
      saved(payload.event, "Calendar event rescheduled");
    } catch (requestError) {
      info.revert();
      setNotice(requestError instanceof Error ? requestError.message : "Unable to reschedule event");
      setNoticeTone("error");
    }
  }

  function updateFilter(key: keyof QueryFilters, value: string) {
    setQueryFilters((current) => ({ ...current, [key]: value }));
  }

  function localDateValue(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function updateDateRange(key: "dateFrom" | "dateTo", value: string) {
    const nextFilters = { ...queryFilters, [key]: value };
    if (
      nextFilters.dateFrom &&
      nextFilters.dateTo &&
      nextFilters.dateTo < nextFilters.dateFrom
    ) {
      if (key === "dateFrom") nextFilters.dateTo = "";
      else nextFilters.dateFrom = value;
    }
    setQueryFilters(nextFilters);
    const api = calendarRef.current?.getApi();
    if (!api) return;

    const navigationDate = nextFilters.dateFrom || nextFilters.dateTo;
    if (navigationDate) api.gotoDate(localDateValue(navigationDate));
    let nextView = view;
    if (nextFilters.dateFrom && nextFilters.dateTo) {
      const start = localDateValue(nextFilters.dateFrom);
      const end = localDateValue(nextFilters.dateTo);
      const inclusiveDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
      nextView = inclusiveDays <= 1 ? "day" : inclusiveDays <= 7 ? "week" : "month";
      setView(nextView);
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      api.changeView(
        mobile
          ? nextView === "month"
            ? "listMonth"
            : nextView === "week"
              ? "listWeek"
              : "listDay"
          : calendarViews[nextView],
        start,
      );
    }
    syncUrl(api, nextView, nextFilters);
  }

  function clearFilters() {
    setQueryFilters(emptyQueryFilters);
    const api = calendarRef.current?.getApi();
    if (api) syncUrl(api, view, emptyQueryFilters);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-6" />
            <h1 className="text-2xl font-semibold tracking-tight">Public Calendar</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Coordinate employee leave, job sites, and company events.</p>
        </div>
        <Button onClick={() => openCreate()}>
          <CirclePlus /> Create Event
        </Button>
      </div>

      <Card size="sm">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{loading ? "Loading visible range…" : `${events.length} event${events.length === 1 ? "" : "s"} in view`}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full bg-muted p-1" aria-label="Calendar view">
                {(["day", "week", "month"] as ViewName[]).map((item) => (
                  <Button
                    aria-pressed={view === item}
                    className={view === item ? "capitalize shadow-sm ring-1 ring-primary/20" : "capitalize"}
                    key={item}
                    onClick={() => changeView(item)}
                    size="sm"
                    variant={view === item ? "default" : "ghost"}
                  >
                    {item}
                  </Button>
                ))}
              </div>
              <Button size="icon-sm" variant="outline" onClick={() => navigate("prev")} aria-label="Previous period"><ChevronLeft /></Button>
              <Button size="sm" variant="outline" onClick={() => navigate("today")}><RotateCcw /> Today</Button>
              <Button size="icon-sm" variant="outline" onClick={() => navigate("next")} aria-label="Next period"><ChevronRight /></Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Calendar event legend">
            {(Object.entries(typeMeta) as Array<[CalendarEventType, (typeof typeMeta)[CalendarEventType]]>).map(([key, item]) => (
              <Badge key={key} variant="outline" className={`calendar-legend ${item.className}`}>
                <span aria-hidden="true" className="calendar-marker">{item.marker}</span>{item.label}
              </Badge>
            ))}
          </div>
          <div className="mt-4 border-t pt-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <SlidersHorizontal className="size-4" /> Filters
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <FilterField label="Employee">
                <Select value={queryFilters.employeeId || "all"} onValueChange={(value) => updateFilter("employeeId", value === "all" ? "" : String(value))}>
                  <SelectTrigger className="w-full"><SelectValue>{filters.employees.find((employee) => employee.id === queryFilters.employeeId)?.employee_name ?? "All Employees"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Employees</SelectItem>{filters.employees.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.employee_name}</SelectItem>)}</SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Event Type">
                <Select value={queryFilters.eventType || "all"} onValueChange={(value) => updateFilter("eventType", value === "all" ? "" : String(value))}>
                  <SelectTrigger className="w-full"><SelectValue>{queryFilters.eventType ? typeMeta[queryFilters.eventType as CalendarEventType]?.label : "All Event Types"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="all">All Event Types</SelectItem>{Object.entries(typeMeta).map(([key, meta]) => <SelectItem key={key} value={key}>{meta.label}</SelectItem>)}</SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Status">
                <Select value={queryFilters.status} onValueChange={(value) => updateFilter("status", String(value))}>
                  <SelectTrigger className="w-full"><SelectValue>{queryFilters.status === "scheduled" ? "Scheduled" : queryFilters.status === "cancelled" ? "Cancelled" : "All Statuses"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="scheduled">Scheduled</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem><SelectItem value="all">All Statuses</SelectItem></SelectContent>
                </Select>
              </FilterField>
              <FilterField label="Range Start">
                <Input aria-label="Range start" max={queryFilters.dateTo || undefined} type="date" value={queryFilters.dateFrom} onChange={(event) => updateDateRange("dateFrom", event.target.value)} />
              </FilterField>
              <FilterField label="Range End">
                <Input aria-label="Range end" min={queryFilters.dateFrom || undefined} type="date" value={queryFilters.dateTo} onChange={(event) => updateDateRange("dateTo", event.target.value)} />
              </FilterField>
              <div className="flex items-end">
                <Button className="w-full" type="button" variant="outline" onClick={clearFilters}><X /> Clear Filters</Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
          <div className="calendar-shell min-h-[680px]" aria-busy={loading}>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
              initialDate={initialDate}
              initialView={calendarViews[view]}
              headerToolbar={false}
              height="auto"
              nowIndicator
              selectable
              editable
              events={eventSource}
              datesSet={datesSet}
              select={selectSlot}
              eventClick={openEvent}
              eventDrop={(info) => void reschedule(info)}
              eventResize={(info) => void reschedule(info)}
              eventContent={(info: EventContentArg) => <CalendarEventContent info={info} />}
              dayMaxEvents={3}
            />
          </div>
        </CardContent>
      </Card>
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        selection={selection}
        filters={filters}
        onSaved={saved}
      />
      <EventDetailDialog eventId={detailEventId} open={detailOpen} onOpenChange={setDetailOpen} onEdit={editFromDetail} onChanged={saved} onDeleted={deleted} />
      {notice ? <div role="status" className={`fixed right-4 top-4 z-[70] flex max-w-sm items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-lg ${noticeTone === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}><CheckCircle className="size-4 shrink-0" /> {notice}</div> : null}
    </div>
  );
}

function CalendarEventContent({ info }: { info: EventContentArg }) {
  const event = info.event.extendedProps.calendarEvent as CalendarEvent;
  const meta = typeMeta[event.event_type];
  return (
    <div className="flex min-w-0 items-center gap-1 px-1" aria-label={`${meta.label}: ${event.title}`}>
      <span className="calendar-marker" aria-hidden="true">{meta.marker}</span>
      {info.timeText ? <span className="shrink-0 font-medium">{info.timeText}</span> : null}
      <span className="truncate">{event.title}</span>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </div>
  );
}
