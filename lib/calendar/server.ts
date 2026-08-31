import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calendarEventStatuses,
  calendarEventTypes,
  holidayTypes,
  type CalendarConflict,
  type CalendarEmployee,
  type CalendarEvent,
  type CalendarEventStatus,
  type CalendarEventType,
  type CalendarJob,
  type HolidayType,
} from "./types";

export const calendarEventColumns =
  "id,event_type,event_status,title,starts_at,ends_at,all_day,holiday_type,job_id,purchase_order_id,customer_id,job_number_snapshot,purchase_order_number_snapshot,customer_name_snapshot,project_name_snapshot,site_address,description,notes,created_by,updated_by,cancelled_by,cancelled_at,created_at,updated_at";

export function calendarJsonError(error: string, status: number, extra = {}) {
  return Response.json({ error, ...extra }, { status });
}

export function calendarText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function uniqueIds(value: unknown) {
  return Array.isArray(value)
    ? Array.from(
        new Set(
          value.filter(
            (item): item is string => typeof item === "string" && !!item.trim(),
          ),
        ),
      )
    : [];
}

export function isEventType(value: unknown): value is CalendarEventType {
  return calendarEventTypes.includes(value as CalendarEventType);
}

export function isEventStatus(value: unknown): value is CalendarEventStatus {
  return calendarEventStatuses.includes(value as CalendarEventStatus);
}

export function isHolidayType(value: unknown): value is HolidayType {
  return holidayTypes.includes(value as HolidayType);
}

export function parseInterval(startsAt: unknown, endsAt: unknown) {
  if (typeof startsAt !== "string" || typeof endsAt !== "string") {
    return { error: "Start and end date/time are required" } as const;
  }
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Start and end date/time must be valid" } as const;
  }
  if (end <= start) {
    return { error: "End date/time must be after the start date/time" } as const;
  }
  return {
    value: { starts_at: start.toISOString(), ends_at: end.toISOString() },
  } as const;
}

export async function getActiveCalendarEmployees(
  admin: SupabaseClient,
  orgId: string,
) {
  const { data, error } = await admin
    .from("employee_directory")
    .select("id,employee_name,email")
    .eq("org_id", orgId)
    .eq("employee_status", "active")
    .order("employee_name");
  return { employees: (data ?? []) as CalendarEmployee[], error };
}

export async function validateActiveEmployees(
  admin: SupabaseClient,
  orgId: string,
  employeeIds: string[],
) {
  if (!employeeIds.length) return { employees: [] as CalendarEmployee[] };
  const { data, error } = await admin
    .from("employee_directory")
    .select("id,employee_name,email")
    .eq("org_id", orgId)
    .eq("employee_status", "active")
    .in("id", employeeIds);
  if (error) return { error };
  const employees = (data ?? []) as CalendarEmployee[];
  return employees.length === employeeIds.length
    ? { employees }
    : { invalid: true as const, employees };
}

export async function checkCalendarConflicts(
  admin: SupabaseClient,
  options: {
    orgId: string;
    employeeIds: string[];
    startsAt: string;
    endsAt: string;
    eventType: CalendarEventType;
    excludeEventId?: string | null;
  },
) {
  if (!options.employeeIds.length) {
    return { conflicts: [] as CalendarConflict[], error: null };
  }
  const { data, error } = await admin.rpc("check_public_calendar_conflicts", {
    p_org_id: options.orgId,
    p_employee_ids: options.employeeIds,
    p_starts_at: options.startsAt,
    p_ends_at: options.endsAt,
    p_requested_event_type: options.eventType,
    p_exclude_event_id: options.excludeEventId ?? null,
  });
  return { conflicts: (data ?? []) as CalendarConflict[], error };
}

type ParticipantRow = {
  event_id: string;
  employee_id: string;
  participation_required: boolean;
};

export async function hydrateCalendarEvents(
  admin: SupabaseClient,
  orgId: string,
  rows: Array<Record<string, unknown>>,
) {
  if (!rows.length) return { events: [] as CalendarEvent[], error: null };
  const eventIds = rows.map((row) => String(row.id));
  const { data: participantData, error: participantError } = await admin
    .from("public_calendar_event_participants")
    .select("event_id,employee_id,participation_required")
    .eq("org_id", orgId)
    .in("event_id", eventIds);
  if (participantError) return { events: [] as CalendarEvent[], error: participantError };

  const participants = (participantData ?? []) as ParticipantRow[];
  const employeeIds = Array.from(new Set(participants.map((row) => row.employee_id)));
  const actorIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.created_by, row.updated_by]).filter(Boolean) as string[],
    ),
  );
  const [employeeResult, profileResult] = await Promise.all([
    employeeIds.length
      ? admin
          .from("employee_directory")
          .select("id,employee_name")
          .eq("org_id", orgId)
          .in("id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    actorIds.length
      ? admin.from("profiles").select("id,full_name,email").in("id", actorIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = employeeResult.error ?? profileResult.error;
  if (relatedError) return { events: [] as CalendarEvent[], error: relatedError };

  const names = new Map(
    (employeeResult.data ?? []).map((row) => [row.id as string, row.employee_name as string]),
  );
  const actors = new Map(
    (profileResult.data ?? []).map((row) => [
      row.id as string,
      (row.full_name || row.email || "Unknown user") as string,
    ]),
  );
  const byEvent = new Map<string, CalendarEvent["participants"]>();
  eventIds.forEach((id) => byEvent.set(id, []));
  participants.forEach((row) => {
    byEvent.get(row.event_id)?.push({
      employee_id: row.employee_id,
      employee_name: names.get(row.employee_id) ?? "Unknown employee",
      participation_required: row.participation_required,
    });
  });

  return {
    error: null,
    events: rows.map((row) => ({
      ...row,
      created_by_name: row.created_by ? actors.get(String(row.created_by)) ?? null : null,
      updated_by_name: row.updated_by ? actors.get(String(row.updated_by)) ?? null : null,
      participants: byEvent.get(String(row.id)) ?? [],
    })) as CalendarEvent[],
  };
}

export async function listCalendarEvents(
  admin: SupabaseClient,
  orgId: string,
  filters: {
    start: string;
    end: string;
    employeeId?: string | null;
    customerId?: string | null;
    project?: string | null;
    jobNumber?: string | null;
    poNumber?: string | null;
    eventType?: CalendarEventType | null;
    status?: CalendarEventStatus | "all" | null;
  },
) {
  let eventIds: string[] | null = null;
  if (filters.employeeId) {
    const { data, error } = await admin
      .from("public_calendar_event_participants")
      .select("event_id")
      .eq("org_id", orgId)
      .eq("employee_id", filters.employeeId);
    if (error) return { events: [] as CalendarEvent[], error };
    eventIds = (data ?? []).map((row) => row.event_id as string);
    if (!eventIds.length) return { events: [] as CalendarEvent[], error: null };
  }

  let query = admin
    .from("public_calendar_events")
    .select(calendarEventColumns)
    .eq("org_id", orgId)
    .lt("starts_at", filters.end)
    .gt("ends_at", filters.start)
    .order("starts_at", { ascending: true });
  if (eventIds) query = query.in("id", eventIds);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.status !== "all") query = query.eq("event_status", filters.status ?? "scheduled");
  if (filters.project) query = query.ilike("project_name_snapshot", `%${filters.project}%`);
  if (filters.jobNumber) query = query.ilike("job_number_snapshot", `%${filters.jobNumber}%`);
  if (filters.poNumber) query = query.ilike("purchase_order_number_snapshot", `%${filters.poNumber}%`);
  const { data, error } = await query;
  if (error) return { events: [] as CalendarEvent[], error };
  return hydrateCalendarEvents(admin, orgId, (data ?? []) as Array<Record<string, unknown>>);
}

export async function getCalendarJob(
  admin: SupabaseClient,
  orgId: string,
  jobId: string,
) {
  const { data: job, error: jobError } = await admin
    .from("jobs")
    .select("id,job_number,job_status,customer_id,latest_accepted_quotation_id")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (jobError || !job) return { job: null, error: jobError };
  const [quotationResult, customerResult, allocationResult] = await Promise.all([
    admin
      .from("quotations")
      .select("id,project_name")
      .eq("id", job.latest_accepted_quotation_id)
      .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("customers")
      .select("id,company_name")
      .eq("id", job.customer_id)
      .eq("org_id", orgId)
      .maybeSingle(),
    admin
      .from("job_purchase_order_allocations")
      .select("purchase_order_id")
      .eq("job_id", job.id)
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle(),
  ]);
  const error = quotationResult.error ?? customerResult.error ?? allocationResult.error;
  if (error || !quotationResult.data || !customerResult.data) return { job: null, error };
  const purchaseOrderResult = allocationResult.data?.purchase_order_id
    ? await admin
        .from("job_purchase_orders")
        .select("id,po_number")
        .eq("id", allocationResult.data.purchase_order_id)
        .eq("org_id", orgId)
        .maybeSingle()
    : { data: null, error: null };
  if (purchaseOrderResult.error) return { job: null, error: purchaseOrderResult.error };
  return {
    error: null,
    job: {
      id: job.id,
      job_number: job.job_number,
      job_status: job.job_status,
      customer_id: job.customer_id,
      customer_name: customerResult.data.company_name,
      project_name: quotationResult.data.project_name,
      purchase_order_id: purchaseOrderResult.data?.id ?? null,
      purchase_order_number: purchaseOrderResult.data?.po_number ?? null,
    } as CalendarJob,
  };
}

export async function listCalendarJobs(admin: SupabaseClient, orgId: string) {
  const { data, error } = await admin
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .eq("job_status", "work_in_process")
    .order("accepted_at", { ascending: false })
    .limit(200);
  if (error) return { jobs: [] as CalendarJob[], error };
  const results = await Promise.all(
    (data ?? []).map((row) => getCalendarJob(admin, orgId, row.id as string)),
  );
  const firstError = results.find((result) => result.error)?.error ?? null;
  return {
    jobs: results.flatMap((result) => (result.job ? [result.job] : [])),
    error: firstError,
  };
}

export type CalendarEventBody = {
  event_type?: unknown;
  title?: unknown;
  starts_at?: unknown;
  ends_at?: unknown;
  holiday_type?: unknown;
  job_id?: unknown;
  employee_ids?: unknown;
  participation_required?: unknown;
  site_address?: unknown;
  description?: unknown;
  notes?: unknown;
  allow_warnings?: unknown;
};

export async function prepareCalendarEvent(
  admin: SupabaseClient,
  orgId: string,
  body: CalendarEventBody,
  excludeEventId?: string | null,
) {
  if (!isEventType(body.event_type)) return { error: "Event type is invalid", status: 400 };
  const interval = parseInterval(body.starts_at, body.ends_at);
  if (interval.error) return { error: interval.error, status: 400 };
  const employeeIds = uniqueIds(body.employee_ids);
  let title = calendarText(body.title);
  let holidayType: HolidayType | null = null;
  let job: CalendarJob | null = null;
  let allDay = false;

  if (body.event_type === "employee_holiday") {
    if (employeeIds.length !== 1) return { error: "Select exactly one employee", status: 400 };
    if (!isHolidayType(body.holiday_type)) return { error: "Holiday type is required", status: 400 };
    holidayType = body.holiday_type;
    allDay = true;
  } else if (body.event_type === "job_site_assignment") {
    const jobId = calendarText(body.job_id);
    if (!jobId) return { error: "Job is required", status: 400 };
    if (!employeeIds.length) return { error: "Select at least one employee", status: 400 };
    const jobResult = await getCalendarJob(admin, orgId, jobId);
    if (jobResult.error) return { error: "Unable to validate job", status: 500 };
    if (!jobResult.job) return { error: "Job not found", status: 404 };
    if (jobResult.job.job_status !== "work_in_process") {
      return { error: "Only work-in-process jobs can be scheduled", status: 409 };
    }
    job = jobResult.job;
    title = `Job ${job.job_number ?? "assignment"}${job.project_name ? ` · ${job.project_name}` : ""}`;
  } else if (!title) {
    return { error: "Event title is required", status: 400 };
  }

  const employeeResult = await validateActiveEmployees(admin, orgId, employeeIds);
  if (employeeResult.error) return { error: "Unable to validate employees", status: 500 };
  if (employeeResult.invalid) return { error: "Every participant must be an active employee", status: 400 };
  if (body.event_type === "employee_holiday") {
    const label = String(holidayType).replaceAll("_", " ");
    title = `${employeeResult.employees[0].employee_name} · ${label.replace(/\b\w/g, (letter) => letter.toUpperCase())}`;
  }

  const conflictResult = await checkCalendarConflicts(admin, {
    orgId,
    employeeIds,
    startsAt: interval.value.starts_at,
    endsAt: interval.value.ends_at,
    eventType: body.event_type,
    excludeEventId,
  });
  if (conflictResult.error) return { error: "Unable to check employee availability", status: 500 };
  const hardConflicts = conflictResult.conflicts.filter((item) => item.conflict_level === "hard_conflict");
  const warnings = conflictResult.conflicts.filter((item) => item.conflict_level === "warning");
  if (hardConflicts.length) return { error: "Employee scheduling conflict", status: 409, conflicts: hardConflicts };
  if (warnings.length && body.allow_warnings !== true) {
    return { error: "Employee availability warning", status: 409, conflicts: warnings, requires_confirmation: true };
  }

  return {
    event: {
      event_type: body.event_type,
      event_status: "scheduled" as const,
      title: title!,
      ...interval.value,
      all_day: allDay,
      holiday_type: holidayType,
      job_id: job?.id ?? null,
      purchase_order_id: job?.purchase_order_id ?? null,
      customer_id: job?.customer_id ?? null,
      job_number_snapshot: job?.job_number ?? null,
      purchase_order_number_snapshot: job?.purchase_order_number ?? null,
      customer_name_snapshot: job?.customer_name ?? null,
      project_name_snapshot: job?.project_name ?? null,
      site_address: calendarText(body.site_address),
      description: calendarText(body.description),
      notes: calendarText(body.notes),
    },
    employeeIds,
    participationRequired: body.participation_required !== false,
    warnings,
  };
}

export function isCalendarConflictDatabaseError(error: { code?: string; message?: string }) {
  const text = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return text.includes("conflict") || text.includes("overlap") || error.code === "23P01";
}
