import type { EmployeeDirectoryRole } from "./access";

export function requiresDepartmentRoleConfirmation(
  currentRole: EmployeeDirectoryRole,
  nextRole: EmployeeDirectoryRole,
) {
  return (
    (currentRole === "sales" && nextRole === "accounts") ||
    (currentRole === "accounts" && nextRole === "sales")
  );
}

export function isEmployeeRoleChangeLocked(sourceType: "manual" | "system") {
  return sourceType === "system";
}
