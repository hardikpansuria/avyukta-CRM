export const publicCalendarRoles = new Set([
  "org_admin",
  "admin",
  "sales",
  "accountant",
  "accounts",
]);

export function canAccessPublicCalendar(role: string) {
  return publicCalendarRoles.has(role);
}

