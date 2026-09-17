import { describe, expect, it } from "vitest";

import {
  isEmployeeRoleChangeLocked,
  requiresDepartmentRoleConfirmation,
} from "./role-change";

describe("employee role changes", () => {
  it("requires confirmation when moving between Sales and Accounts", () => {
    expect(requiresDepartmentRoleConfirmation("sales", "accounts")).toBe(true);
    expect(requiresDepartmentRoleConfirmation("accounts", "sales")).toBe(true);
  });

  it("does not require the department confirmation for other changes", () => {
    expect(requiresDepartmentRoleConfirmation("worker", "sales")).toBe(false);
    expect(requiresDepartmentRoleConfirmation("sales", "admin")).toBe(false);
    expect(requiresDepartmentRoleConfirmation("sales", "sales")).toBe(false);
  });

  it("locks roles derived from CRM membership", () => {
    expect(isEmployeeRoleChangeLocked("system")).toBe(true);
    expect(isEmployeeRoleChangeLocked("manual")).toBe(false);
  });
});
