"use client";

import { AlertTriangle, BriefcaseBusiness, Building2, CalendarHeart, Check, LoaderCircle } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CalendarConflict, CalendarEmployee, CalendarEvent, CalendarEventType, CalendarJob, HolidayType } from "@/lib/calendar/types";

export type CalendarFilters = {
  employees: CalendarEmployee[];
  jobs: CalendarJob[];
  customers: Array<{ id: string; company_name: string }>;
};

type Selection = { start: Date; end: Date; allDay: boolean } | null;

const holidayLabels: Record<HolidayType, string> = {
  vacation: "Vacation",
  personal_leave: "Personal Leave",
  sick_leave: "Sick Leave",
  statutory_holiday: "Statutory Holiday",
  other: "Other",
};

const eventTypeLabels: Record<CalendarEventType, string> = {
  employee_holiday: "Employee Holiday",
  job_site_assignment: "Job Site Assignment",
  company_event: "Company Event",
};

function localDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function localTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function localDateTime(dateValue: string, timeValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
    ? null
    : date;
}

function holidayInterval(startValue: string, endValue: string) {
  const [startYear, startMonth, startDay] = startValue.split("-").map(Number);
  const [endYear, endMonth, endDay] = endValue.split("-").map(Number);
  const start = new Date(startYear, startMonth - 1, startDay, 0, 0, 0, 0);
  const end = new Date(endYear, endMonth - 1, endDay + 1, 0, 0, 0, 0);
  return { start, end };
}

function initialValues(event: CalendarEvent | null, selection: Selection) {
  const start = event ? new Date(event.starts_at) : selection?.start ?? new Date();
  const selectedEnd = event ? new Date(event.ends_at) : selection?.end;
  const end = selectedEnd && selectedEnd > start ? selectedEnd : new Date(start.getTime() + 60 * 60 * 1000);
  const holidayEnd = new Date(end);
  if (event?.all_day) holidayEnd.setDate(holidayEnd.getDate() - 1);
  return {
    type: event?.event_type ?? "employee_holiday" as CalendarEventType,
    title: event?.title ?? "",
    employeeIds: event?.participants.map((item) => item.employee_id) ?? [],
    holidayType: event?.holiday_type ?? "vacation" as HolidayType,
    startDate: localDate(start),
    endDate: localDate(holidayEnd),
    assignmentDate: localDate(start),
    startTime: localTime(start),
    endTime: localTime(end),
    jobId: event?.job_id ?? "",
    siteAddress: event?.site_address ?? "",
    notes: event?.notes ?? "",
    description: event?.description ?? "",
    participationRequired: event?.participants[0]?.participation_required ?? true,
  };
}

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  selection,
  filters,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
  selection: Selection;
  filters: CalendarFilters;
  onSaved: (event: CalendarEvent, message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <EventForm
          key={`${event?.id ?? "new"}-${selection?.start.toISOString() ?? "manual"}`}
          event={event}
          selection={selection}
          filters={filters}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      ) : null}
    </Dialog>
  );
}

function EventForm({ event, selection, filters, onCancel, onSaved }: {
  event: CalendarEvent | null;
  selection: Selection;
  filters: CalendarFilters;
  onCancel: () => void;
  onSaved: (event: CalendarEvent, message: string) => void;
}) {
  const values = initialValues(event, selection);
  const [eventType, setEventType] = useState(values.type);
  const [title, setTitle] = useState(values.title);
  const [employeeIds, setEmployeeIds] = useState(values.employeeIds);
  const [holidayType, setHolidayType] = useState(values.holidayType);
  const [startDate, setStartDate] = useState(values.startDate);
  const [endDate, setEndDate] = useState(values.endDate);
  const [assignmentDate, setAssignmentDate] = useState(values.assignmentDate);
  const [startTime, setStartTime] = useState(values.startTime || "09:00");
  const [endTime, setEndTime] = useState(values.endTime || "17:00");
  const [jobId, setJobId] = useState(values.jobId);
  const [siteAddress, setSiteAddress] = useState(values.siteAddress);
  const [notes, setNotes] = useState(values.notes);
  const [description, setDescription] = useState(values.description);
  const [participationRequired, setParticipationRequired] = useState(values.participationRequired);
  const [availability, setAvailability] = useState<Record<string, { availability: string; conflicts: CalendarConflict[] }>>({});
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [warningPending, setWarningPending] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedJob = filters.jobs.find((job) => job.id === jobId) ?? null;

  const timedInterval = useMemo(() => {
    const start = localDateTime(assignmentDate, startTime);
    const end = localDateTime(assignmentDate, endTime);
    return start && end && end > start ? { start, end } : null;
  }, [assignmentDate, endTime, startTime]);

  useEffect(() => {
    if (eventType !== "job_site_assignment" || !timedInterval) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({
        start: timedInterval.start.toISOString(),
        end: timedInterval.end.toISOString(),
        eventType,
      });
      if (event) params.set("excludeEventId", event.id);
      try {
        const response = await fetch(`/api/org/calendar/employees/availability?${params}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { employees?: Array<CalendarEmployee & { availability: string; conflicts: CalendarConflict[] }> };
        if (!response.ok) return;
        setAvailability(Object.fromEntries((payload.employees ?? []).map((employee) => [employee.id, employee])));
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setAvailability({});
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [event, eventType, timedInterval]);

  function toggleEmployee(employeeId: string, checked: boolean) {
    if (eventType === "employee_holiday") {
      setEmployeeIds(checked ? [employeeId] : []);
      return;
    }
    setEmployeeIds((current) => checked ? [...new Set([...current, employeeId])] : current.filter((id) => id !== employeeId));
  }

  function buildPayload(allowWarnings: boolean) {
    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    if (eventType === "employee_holiday") {
      const interval = holidayInterval(startDate, endDate);
      startsAt = interval.start;
      endsAt = interval.end;
    } else {
      startsAt = timedInterval?.start ?? null;
      endsAt = timedInterval?.end ?? null;
    }
    if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      throw new Error("Enter a valid date range with an end after the start");
    }
    return {
      event_type: eventType,
      title,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      holiday_type: eventType === "employee_holiday" ? holidayType : null,
      job_id: eventType === "job_site_assignment" ? jobId : null,
      employee_ids: employeeIds,
      participation_required: participationRequired,
      site_address: eventType === "job_site_assignment" ? siteAddress : null,
      description: eventType === "company_event" ? description : null,
      notes: eventType !== "company_event" ? notes : null,
      allow_warnings: allowWarnings,
    };
  }

  async function save(allowWarnings: boolean) {
    setError("");
    setConflicts([]);
    setSaving(true);
    try {
      const payload = buildPayload(allowWarnings);
      const response = await fetch(event ? `/api/org/calendar/events/${event.id}` : "/api/org/calendar/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { event?: CalendarEvent; error?: string; conflicts?: CalendarConflict[]; requires_confirmation?: boolean };
      if (!response.ok) {
        setConflicts(result.conflicts ?? []);
        setWarningPending(Boolean(result.requires_confirmation));
        throw new Error(result.error || "Unable to save event");
      }
      if (!result.event) throw new Error("The saved event was not returned");
      onSaved(result.event, event ? "Calendar event updated" : "Calendar event created");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save event");
    } finally {
      setSaving(false);
    }
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    void save(false);
  }

  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto rounded-xl sm:max-w-3xl" showCloseButton={!saving}>
      <DialogHeader>
        <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
        <DialogDescription>Scheduling is saved immediately after server validation. Times use your current device timezone.</DialogDescription>
      </DialogHeader>
      <form className="space-y-5" onSubmit={submit}>
        <Field label="Event Type" required>
          <Select disabled={Boolean(event)} value={eventType} onValueChange={(value) => { setEventType(value as CalendarEventType); setEmployeeIds([]); setConflicts([]); }}>
            <SelectTrigger className="w-full"><SelectValue>{eventTypeLabels[eventType]}</SelectValue></SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="employee_holiday"><CalendarHeart /> Employee Holiday</SelectItem>
              <SelectItem value="job_site_assignment"><BriefcaseBusiness /> Job Site Assignment</SelectItem>
              <SelectItem value="company_event"><Building2 /> Company Event</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {eventType === "employee_holiday" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Holiday Type" required>
              <Select value={holidayType} onValueChange={(value) => setHolidayType(value as HolidayType)}>
                <SelectTrigger className="w-full"><SelectValue>{holidayLabels[holidayType]}</SelectValue></SelectTrigger>
                <SelectContent>{Object.entries(holidayLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <EmployeePicker employees={filters.employees} selected={employeeIds} availability={availability} single onToggle={toggleEmployee} />
            <Field label="Start Date" required><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
            <Field label="End Date" required><Input type="date" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>
        ) : null}

        {eventType === "job_site_assignment" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Job" required>
              <Select value={jobId || "__none"} onValueChange={(value) => setJobId(String(value) === "__none" ? "" : String(value))}>
                <SelectTrigger className="w-full"><SelectValue>{selectedJob ? `#${selectedJob.job_number ?? "—"} · ${selectedJob.customer_name} · ${selectedJob.project_name ?? "No project"}` : "Select Work-in-Process Job"}</SelectValue></SelectTrigger>
                <SelectContent align="start"><SelectItem value="__none">Select job</SelectItem>{filters.jobs.map((job) => <SelectItem value={job.id} key={job.id}>#{job.job_number ?? "—"} · {job.customer_name} · {job.project_name ?? "No project"}</SelectItem>)}</SelectContent>
              </Select>
            </Field></div>
            {selectedJob ? <div className="sm:col-span-2 grid gap-2 rounded-2xl bg-muted p-4 text-sm sm:grid-cols-2"><span><b>PO:</b> {selectedJob.purchase_order_number ?? "Not allocated"}</span><span><b>Customer:</b> {selectedJob.customer_name}</span><span className="sm:col-span-2"><b>Project:</b> {selectedJob.project_name ?? "—"}</span></div> : null}
            <Field label="Assignment Date" required><Input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Start Time" required><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field><Field label="End Time" required><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><EmployeePicker employees={filters.employees} selected={employeeIds} availability={availability} onToggle={toggleEmployee} /></div>
            <div className="sm:col-span-2"><Field label="Site Address"><Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
          </div>
        ) : null}

        {eventType === "company_event" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Event Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Safety Meeting" /></Field></div>
            <Field label="Event Date" required><Input type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Start Time" required><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></Field><Field label="End Time" required><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><EmployeePicker employees={filters.employees} selected={employeeIds} availability={{}} optional onToggle={toggleEmployee} /></div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm"><Checkbox checked={participationRequired} onChange={(e) => setParticipationRequired(e.target.checked)} /> Participation is required for selected employees</label>
            <div className="sm:col-span-2"><Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></Field></div>
          </div>
        ) : null}

        {error ? <Alert variant={warningPending ? "default" : "destructive"}><AlertTriangle /><AlertTitle>{warningPending ? "Review scheduling warning" : error}</AlertTitle><AlertDescription>{warningPending ? error : "Correct the highlighted scheduling issue and try again."}</AlertDescription></Alert> : null}
        {conflicts.length ? <ConflictList conflicts={conflicts} /> : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
          {warningPending ? <Button type="button" variant="secondary" onClick={() => void save(true)} disabled={saving}>Continue Anyway</Button> : null}
          <Button type="submit" disabled={saving}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Check />}{saving ? "Saving…" : "Save Event"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EmployeePicker({ employees, selected, availability, onToggle, single = false, optional = false }: {
  employees: CalendarEmployee[];
  selected: string[];
  availability: Record<string, { availability: string; conflicts: CalendarConflict[] }>;
  onToggle: (id: string, checked: boolean) => void;
  single?: boolean;
  optional?: boolean;
}) {
  return <Field label={`Employee${single ? "" : "s"}${optional ? " (Optional)" : ""}`} required={!optional}>
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-2xl border p-2">
      {employees.map((employee) => {
        const state = availability[employee.id];
        const unavailable = state?.availability === "unavailable";
        const warning = state?.availability === "warning";
        const reason = state?.conflicts[0]?.conflict_message;
        return <label key={employee.id} className={`flex items-start gap-3 rounded-xl px-3 py-2 text-sm ${unavailable ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-muted"}`} title={reason}>
          <Checkbox checked={selected.includes(employee.id)} disabled={unavailable} onChange={(e) => onToggle(employee.id, e.target.checked)} />
          <span className="min-w-0 flex-1"><span className="font-medium">{employee.employee_name}</span>{employee.email ? <span className="block truncate text-xs text-muted-foreground">{employee.email}</span> : null}{reason ? <span className="block text-xs text-muted-foreground">{reason}</span> : null}</span>
          {unavailable ? <Badge variant="destructive">Unavailable</Badge> : warning ? <Badge variant="outline"><AlertTriangle /> Warning</Badge> : state ? <Badge variant="secondary">Available</Badge> : null}
        </label>;
      })}
      {!employees.length ? <p className="p-3 text-sm text-muted-foreground">No active employees found.</p> : null}
    </div>
  </Field>;
}

function ConflictList({ conflicts }: { conflicts: CalendarConflict[] }) {
  return <div className="space-y-2 rounded-2xl border p-3">
    {conflicts.map((conflict, index) => <div key={`${conflict.conflicting_event_id}-${conflict.employee_id}-${index}`} className="flex gap-2 text-sm"><AlertTriangle className={`mt-0.5 size-4 shrink-0 ${conflict.conflict_level === "hard_conflict" ? "text-destructive" : "text-amber-600"}`} /><div><p className="font-medium">{conflict.employee_name} · {conflict.conflicting_event_title}</p><p className="text-muted-foreground">{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(conflict.conflicting_starts_at))} — {new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(conflict.conflicting_ends_at))}</p><p>{conflict.conflict_message}</p></div></div>)}
  </div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <div><Label className="mb-2 block" required={required}>{label}</Label>{children}</div>;
}
