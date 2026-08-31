import { describe, expect, it } from "vitest";

import type { PermissionKey } from "@/lib/auth/permissions";

import { dashboardKindForRole, visibleDashboardWidgets } from "./config";

describe("dashboard configuration", () => {
  it.each([
    ["admin", "owner"],
    ["sales", "sales"],
    ["accountant", "accountant"],
    ["future_role", "operations"],
  ] as const)("maps %s to %s", (role, kind) => {
    expect(dashboardKindForRole(role)).toBe(kind);
  });

  it("only exposes widgets whose permission is effective", () => {
    const permissions = new Set<PermissionKey>(["dashboard.view", "jobs.view"]);
    expect(visibleDashboardWidgets("sales", permissions).map((widget) => widget.id)).toEqual([
      "priorities",
      "company-operations",
      "company-history",
    ]);
  });
});
