import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessPublicCalendar } from "@/lib/calendar/access";
import {
  calendarEventColumns,
  calendarJsonError,
  hydrateCalendarEvents,
  isCalendarConflictDatabaseError,
  prepareCalendarEvent,
  type CalendarEventBody,
} from "@/lib/calendar/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function getEvent(admin: ReturnType<typeof createAdminClient>, orgId: string, eventId: string) {
  return admin
    .from("public_calendar_events")
    .select(calendarEventColumns)
    .eq("id", eventId)
    .eq("org_id", orgId)
    .maybeSingle();
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/org/calendar/events/[eventId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const { eventId } = await context.params;
  const admin = createAdminClient();
  const { data, error } = await getEvent(admin, session.org_id, eventId);
  if (error) return calendarJsonError("Unable to fetch calendar event", 500);
  if (!data) return calendarJsonError("Calendar event not found", 404);
  const hydrated = await hydrateCalendarEvents(admin, session.org_id, [data]);
  if (hydrated.error) return calendarJsonError("Unable to fetch event participants", 500);

  let history: Array<Record<string, unknown>> = [];
  if (session.role === "admin" || session.role === "org_admin") {
    const { data: historyRows, error: historyError } = await admin
      .from("public_calendar_event_history")
      .select("id,action_type,actor_id,occurred_at,previous_data,new_data")
      .eq("org_id", session.org_id)
      .eq("event_id", eventId)
      .order("occurred_at", { ascending: false });
    if (!historyError) {
      const actorIds = Array.from(new Set((historyRows ?? []).map((row) => row.actor_id).filter(Boolean) as string[]));
      const { data: actors } = actorIds.length
        ? await admin.from("profiles").select("id,full_name,email").in("id", actorIds)
        : { data: [] };
      const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name || actor.email]));
      history = (historyRows ?? []).map(({ previous_data, new_data, ...row }) => ({
        ...row,
        actor_name: row.actor_id ? actorMap.get(row.actor_id) ?? "Unknown user" : "System",
        changed_fields: changedFields(previous_data, new_data),
      }));
    }
  }
  return Response.json({ event: hydrated.events[0], history });
}

function changedFields(previous: unknown, next: unknown) {
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") return [];
  const before = previous as Record<string, unknown>;
  const after = next as Record<string, unknown>;
  return Object.keys(after).filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/org/calendar/events/[eventId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const { eventId } = await context.params;
  let patch: CalendarEventBody;
  try {
    patch = (await request.json()) as CalendarEventBody;
  } catch {
    return calendarJsonError("Invalid request body", 400);
  }
  const admin = createAdminClient();
  const { data: existing, error } = await getEvent(admin, session.org_id, eventId);
  if (error) return calendarJsonError("Unable to validate calendar event", 500);
  if (!existing) return calendarJsonError("Calendar event not found", 404);
  if (existing.event_status === "cancelled") return calendarJsonError("Cancelled events cannot be edited", 409);

  const { data: currentParticipants, error: participantReadError } = await admin
    .from("public_calendar_event_participants")
    .select("employee_id,participation_required")
    .eq("org_id", session.org_id)
    .eq("event_id", eventId);
  if (participantReadError) return calendarJsonError("Unable to validate event participants", 500);
  const currentIds = (currentParticipants ?? []).map((row) => row.employee_id as string);
  const merged: CalendarEventBody = {
    event_type: patch.event_type ?? existing.event_type,
    title: patch.title ?? existing.title,
    starts_at: patch.starts_at ?? existing.starts_at,
    ends_at: patch.ends_at ?? existing.ends_at,
    holiday_type: patch.holiday_type ?? existing.holiday_type,
    job_id: patch.job_id ?? existing.job_id,
    employee_ids: patch.employee_ids ?? currentIds,
    participation_required:
      patch.participation_required ?? currentParticipants?.[0]?.participation_required ?? true,
    site_address: patch.site_address ?? existing.site_address,
    description: patch.description ?? existing.description,
    notes: patch.notes ?? existing.notes,
    allow_warnings: patch.allow_warnings,
  };
  const prepared = await prepareCalendarEvent(admin, session.org_id, merged, eventId);
  if (!prepared.event) {
    return calendarJsonError(prepared.error, prepared.status, {
      conflicts: prepared.conflicts ?? [],
      requires_confirmation: prepared.requires_confirmation ?? false,
    });
  }

  const { data: updated, error: updateError } = await admin
    .from("public_calendar_events")
    .update({ ...prepared.event, updated_by: session.user.id })
    .eq("id", eventId)
    .eq("org_id", session.org_id)
    .select(calendarEventColumns)
    .maybeSingle();
  if (updateError || !updated) {
    if (updateError && isCalendarConflictDatabaseError(updateError)) {
      return calendarJsonError("This schedule conflicts with an existing employee event", 409);
    }
    return calendarJsonError("Unable to update calendar event", 500);
  }

  const selected = new Set(prepared.employeeIds);
  const current = new Set(currentIds);
  const added = prepared.employeeIds.filter((id) => !current.has(id));
  const removed = currentIds.filter((id) => !selected.has(id));
  let assignmentError: { code?: string; message?: string } | null = null;
  if (added.length) {
    const result = await admin.from("public_calendar_event_participants").insert(
      added.map((employeeId) => ({
        org_id: session.org_id,
        event_id: eventId,
        employee_id: employeeId,
        participation_required: prepared.participationRequired,
        added_by: session.user.id,
      })),
    );
    assignmentError = result.error;
  }
  if (!assignmentError && removed.length) {
    const result = await admin
      .from("public_calendar_event_participants")
      .delete()
      .eq("org_id", session.org_id)
      .eq("event_id", eventId)
      .in("employee_id", removed);
    assignmentError = result.error;
  }
  if (!assignmentError && prepared.employeeIds.length) {
    const result = await admin
      .from("public_calendar_event_participants")
      .update({ participation_required: prepared.participationRequired })
      .eq("org_id", session.org_id)
      .eq("event_id", eventId)
      .in("employee_id", prepared.employeeIds);
    assignmentError = result.error;
  }

  if (assignmentError) {
    if (added.length) {
      await admin.from("public_calendar_event_participants").delete().eq("org_id", session.org_id).eq("event_id", eventId).in("employee_id", added);
    }
    if (removed.length) {
      await admin.from("public_calendar_event_participants").insert(
        (currentParticipants ?? []).filter((row) => removed.includes(row.employee_id)).map((row) => ({
          org_id: session.org_id,
          event_id: eventId,
          employee_id: row.employee_id,
          participation_required: row.participation_required,
          added_by: session.user.id,
        })),
      );
    }
    await admin.from("public_calendar_events").update({
      event_type: existing.event_type,
      event_status: existing.event_status,
      title: existing.title,
      starts_at: existing.starts_at,
      ends_at: existing.ends_at,
      all_day: existing.all_day,
      holiday_type: existing.holiday_type,
      job_id: existing.job_id,
      purchase_order_id: existing.purchase_order_id,
      customer_id: existing.customer_id,
      job_number_snapshot: existing.job_number_snapshot,
      purchase_order_number_snapshot: existing.purchase_order_number_snapshot,
      customer_name_snapshot: existing.customer_name_snapshot,
      project_name_snapshot: existing.project_name_snapshot,
      site_address: existing.site_address,
      description: existing.description,
      notes: existing.notes,
      updated_by: existing.updated_by,
    }).eq("id", eventId).eq("org_id", session.org_id);
    if (isCalendarConflictDatabaseError(assignmentError)) {
      return calendarJsonError("This schedule conflicts with an existing employee event", 409);
    }
    return calendarJsonError("Unable to synchronize event participants", 500);
  }

  const hydrated = await hydrateCalendarEvents(admin, session.org_id, [updated]);
  return Response.json({ event: hydrated.events[0], warnings: prepared.warnings });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/org/calendar/events/[eventId]">,
) {
  const session = await verifyOrgSession();
  if (!session) return calendarJsonError("Unauthorized", 401);
  if (!canAccessPublicCalendar(session.role)) return calendarJsonError("Forbidden", 403);
  const { eventId } = await context.params;
  const admin = createAdminClient();
  const { data: existing, error } = await getEvent(admin, session.org_id, eventId);
  if (error) return calendarJsonError("Unable to validate calendar event", 500);
  if (!existing) return calendarJsonError("Calendar event not found", 404);
  const { error: deleteError } = await admin
    .from("public_calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("org_id", session.org_id);
  if (deleteError) return calendarJsonError("Unable to delete calendar event", 500);
  return new Response(null, { status: 204 });
}
