"use client";

import { BriefcaseBusiness, Building2, CalendarHeart, Clock3, History, LoaderCircle, MapPin, Pencil, Trash2, UserRoundX, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { CalendarEvent, CalendarEventType } from "@/lib/calendar/types";

type HistoryItem = {
  id: string;
  action_type: string;
  occurred_at: string;
  actor_name: string;
  changed_fields: string[];
};

const labels: Record<CalendarEventType, string> = {
  employee_holiday: "Employee Holiday",
  job_site_assignment: "Job Site Assignment",
  company_event: "Company Event",
};

function EventIcon({ type }: { type: CalendarEventType }) {
  if (type === "employee_holiday") return <CalendarHeart />;
  if (type === "job_site_assignment") return <BriefcaseBusiness />;
  return <Building2 />;
}

function eventRange(event: CalendarEvent) {
  const formatter = new Intl.DateTimeFormat("en-CA", event.all_day
    ? { dateStyle: "medium" }
    : { dateStyle: "medium", timeStyle: "short" });
  const start = new Date(event.starts_at);
  const exclusiveEnd = new Date(event.ends_at);
  const end = event.all_day ? new Date(exclusiveEnd.getTime() - 1) : exclusiveEnd;
  return `${formatter.format(start)} — ${formatter.format(end)}`;
}

export function EventDetailDialog({
  eventId,
  open,
  onOpenChange,
  onEdit,
  onChanged,
  onDeleted,
}: {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (event: CalendarEvent) => void;
  onChanged: (event: CalendarEvent, message: string) => void;
  onDeleted: (eventId: string) => void;
}) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<"cancel" | "delete" | null>(null);

  useEffect(() => {
    if (!open || !eventId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/org/calendar/events/${eventId}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json() as { event?: CalendarEvent; history?: HistoryItem[]; error?: string };
        if (!response.ok || !payload.event) throw new Error(payload.error || "Unable to load event details");
        setEvent(payload.event);
        setHistory(payload.history ?? []);
      } catch (requestError) {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError(requestError instanceof Error ? requestError.message : "Unable to load event details");
      } finally {
        setLoading(false);
      }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [eventId, open]);

  async function performAction() {
    if (!event || !confirmation) return;
    setWorking(true);
    setError("");
    try {
      const response = await fetch(
        confirmation === "cancel" ? `/api/org/calendar/events/${event.id}/cancel` : `/api/org/calendar/events/${event.id}`,
        { method: confirmation === "cancel" ? "POST" : "DELETE" },
      );
      if (confirmation === "delete" && response.status === 204) {
        onDeleted(event.id);
        setConfirmation(null);
        return;
      }
      const payload = await response.json() as { event?: CalendarEvent; error?: string };
      if (!response.ok || !payload.event) throw new Error(payload.error || `Unable to ${confirmation} event`);
      setEvent(payload.event);
      onChanged(payload.event, "Calendar event cancelled");
      setConfirmation(null);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to update event");
    } finally {
      setWorking(false);
    }
  }

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Event Details</DialogTitle>
          <DialogDescription>Directory scheduling details and audit information.</DialogDescription>
        </DialogHeader>
        {loading ? <div className="space-y-3"><Skeleton className="h-8" /><Skeleton className="h-24" /><Skeleton className="h-32" /></div> : null}
        {error ? <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
        {event && !loading ? <div className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-muted"><EventIcon type={event.event_type} /></span>
            <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{event.title}</h2><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{labels[event.event_type]}</Badge><Badge variant={event.event_status === "cancelled" ? "destructive" : "secondary"}>{event.event_status === "cancelled" ? "Cancelled" : "Scheduled"}</Badge></div></div>
          </div>
          <div className="grid gap-3 rounded-2xl bg-muted/60 p-4 text-sm sm:grid-cols-2">
            <Detail icon={<Clock3 />} label="Date and time" value={eventRange(event)} wide />
            <Detail icon={<Users />} label="Participants" value={event.participants.map((item) => item.employee_name).join(", ") || "None"} wide />
            {event.event_type === "employee_holiday" ? <Detail label="Holiday type" value={event.holiday_type?.replaceAll("_", " ") ?? "—"} /> : null}
            {event.event_type === "job_site_assignment" ? <><Detail label="Job Number" value={event.job_number_snapshot ?? "—"} /><Detail label="PO Number" value={event.purchase_order_number_snapshot ?? "—"} /><Detail label="Customer" value={event.customer_name_snapshot ?? "—"} /><Detail label="Project" value={event.project_name_snapshot ?? "—"} />{event.site_address ? <Detail icon={<MapPin />} label="Site Address" value={event.site_address} wide /> : null}</> : null}
            {event.description ? <Detail label="Description" value={event.description} wide /> : null}
            {event.notes ? <Detail label="Notes" value={event.notes} wide /> : null}
            <Detail label="Created By" value={event.created_by_name ?? "System"} /><Detail label="Last Updated" value={new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.updated_at))} />
          </div>
          {history.length ? <div><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><History className="size-4" /> Event History</h3><div className="space-y-2">{history.map((item) => <div key={item.id} className="rounded-2xl border p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><span className="font-medium capitalize">{item.action_type}</span><span className="text-muted-foreground">{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.occurred_at))}</span></div><p className="mt-1 text-muted-foreground">{item.actor_name}{item.changed_fields.length ? ` · Changed: ${item.changed_fields.join(", ")}` : ""}</p></div>)}</div></div> : null}
        </div> : null}
        {event ? <DialogFooter>
          <Button type="button" variant="destructive" onClick={() => setConfirmation("delete")}><Trash2 /> Delete</Button>
          {event.event_status === "scheduled" ? <><Button type="button" variant="outline" onClick={() => setConfirmation("cancel")}><UserRoundX /> Cancel Event</Button><Button type="button" onClick={() => onEdit(event)}><Pencil /> Edit / Reschedule</Button></> : null}
        </DialogFooter> : null}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(confirmation)} onOpenChange={(next) => { if (!next && !working) setConfirmation(null); }}>
      <DialogContent className="rounded-xl" showCloseButton={false}>
        <DialogHeader><DialogTitle>{confirmation === "delete" ? "Permanently delete event?" : "Cancel this event?"}</DialogTitle><DialogDescription>{confirmation === "delete" ? "The event and all participant assignments will be removed. The database audit history remains permanent." : "The event remains in audit history and can be displayed using the Cancelled status filter. It will no longer block scheduling."}</DialogDescription></DialogHeader>
        <DialogFooter><Button type="button" variant="outline" disabled={working} onClick={() => setConfirmation(null)}>Go Back</Button><Button type="button" variant="destructive" disabled={working} onClick={() => void performAction()}>{working ? <LoaderCircle className="animate-spin" /> : null}{working ? "Working…" : confirmation === "delete" ? "Delete Event" : "Cancel Event"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function Detail({ label, value, icon, wide = false }: { label: string; value: string; icon?: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{icon ? <span className="[&_svg]:size-3.5">{icon}</span> : null}{label}</p><p className="mt-1 capitalize">{value}</p></div>;
}
