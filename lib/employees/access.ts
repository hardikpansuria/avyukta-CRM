export const employeeDirectoryRoles = [
  "admin",
  "sales",
  "accounts",
  "worker",
] as const;

export const employeeDirectoryStatuses = ["active", "inactive"] as const;

export type EmployeeDirectoryRole = (typeof employeeDirectoryRoles)[number];
export type EmployeeDirectoryStatus =
  (typeof employeeDirectoryStatuses)[number];

const allowedCrmRoles = new Set([
  "org_admin",
  "admin",
  "sales",
  "accountant",
  "accounts",
]);

export function canAccessEmployeeDirectory(role: string) {
  return allowedCrmRoles.has(role);
}

export function isEmployeeDirectoryRole(
  value: unknown,
): value is EmployeeDirectoryRole {
  return (
    typeof value === "string" &&
    employeeDirectoryRoles.includes(value as EmployeeDirectoryRole)
  );
}

export function isEmployeeDirectoryStatus(
  value: unknown,
): value is EmployeeDirectoryStatus {
  return (
    typeof value === "string" &&
    employeeDirectoryStatuses.includes(value as EmployeeDirectoryStatus)
  );
}
