import { describe, expect, it } from "vitest";

import { dateInRange, resolveDashboardDateRange } from "./date-range";

const now = new Date("2026-08-26T18:00:00.000Z");

describe("resolveDashboardDateRange", () => {
  it("defaults to the current month", () => {
    expect(resolveDashboardDateRange({}, now)).toEqual({
      period: "month",
      from: "2026-08-01",
      to: "2026-08-26",
      label: "This Month",
    });
  });

  it("normalizes a reversed custom range", () => {
    expect(resolveDashboardDateRange({ period: "custom", from: "2026-08-20", to: "2026-08-04" }, now)).toMatchObject({
      from: "2026-08-04",
      to: "2026-08-20",
    });
  });

  it("checks ISO timestamps inclusively", () => {
    const range = resolveDashboardDateRange({ period: "custom", from: "2026-08-04", to: "2026-08-20" }, now);
    expect(dateInRange("2026-08-20T23:59:00Z", range)).toBe(true);
    expect(dateInRange("2026-08-21T00:00:00Z", range)).toBe(false);
  });
});
