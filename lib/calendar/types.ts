export const calendarEventTypes = [
  "employee_holiday",
  "job_site_assignment",
  "company_event",
] as const;

export const calendarEventStatuses = ["scheduled", "cancelled"] as const;
export const holidayTypes = [
  "vacation",
  "personal_leave",
  "sick_leave",
  "statutory_holiday",
  "other",
] as const;

export type CalendarEventType = (typeof calendarEventTypes)[number];
export type CalendarEventStatus = (typeof calendarEventStatuses)[number];
export type HolidayType = (typeof holidayTypes)[number];

export type CalendarParticipant = {
  employee_id: string;
  employee_name: string;
  participation_required: boolean;
};

export type CalendarEvent = {
  id: string;
  event_type: CalendarEventType;
  event_status: CalendarEventStatus;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  holiday_type: HolidayType | null;
  job_id: string | null;
  purchase_order_id: string | null;
  customer_id: string | null;
  job_number_snapshot: string | null;
  purchase_order_number_snapshot: string | null;
  customer_name_snapshot: string | null;
  project_name_snapshot: string | null;
  site_address: string | null;
  description: string | null;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  participants: CalendarParticipant[];
};

export type CalendarConflict = {
  employee_id: string;
  employee_name: string;
  conflicting_event_id: string;
  conflicting_event_type: CalendarEventType;
  conflicting_event_title: string;
  conflicting_starts_at: string;
  conflicting_ends_at: string;
  conflict_level: "hard_conflict" | "warning";
  conflict_message: string;
};

export type CalendarEmployee = {
  id: string;
  employee_name: string;
  email: string | null;
};

export type CalendarJob = {
  id: string;
  job_number: string | null;
  job_status: string;
  customer_id: string;
  customer_name: string;
  project_name: string | null;
  purchase_order_id: string | null;
  purchase_order_number: string | null;
};

