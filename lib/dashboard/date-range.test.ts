import { describe, expect, it } from "vitest";

import {
  dateInRange,
  formatOntarioDashboardDate,
  ontarioDayUtcRange,
  ontarioDate,
  resolveDashboardDateRange,
} from "./date-range";

const now = new Date("2026-08-26T18:00:00.000Z");

describe("resolveDashboardDateRange", () => {
  it("defaults to the current year", () => {
    expect(resolveDashboardDateRange({}, now)).toEqual({
      period: "year",
      from: "2026-01-01",
      to: "2026-08-26",
      label: "This Year",
    });
  });

  it("resets the dashboard date at midnight in Ontario", () => {
    const beforeOntarioMidnight = new Date("2026-09-09T03:59:59.000Z");
    const atOntarioMidnight = new Date("2026-09-09T04:00:00.000Z");

    expect(ontarioDate(beforeOntarioMidnight)).toBe("2026-09-08");
    expect(ontarioDate(atOntarioMidnight)).toBe("2026-09-09");
    expect(resolveDashboardDateRange({}, beforeOntarioMidnight).to).toBe(
      "2026-09-08",
    );
  });

  it("formats the visible day and date in the Ontario time zone", () => {
    expect(
      formatOntarioDashboardDate(new Date("2026-09-09T03:00:00.000Z")),
    ).toBe("Tuesday, September 8, 2026");
  });

  it("uses exact Ontario day boundaries for calendar data", () => {
    expect(ontarioDayUtcRange(new Date("2026-09-09T18:00:00.000Z"))).toEqual({
      start: "2026-09-09T04:00:00.000Z",
      end: "2026-09-10T03:59:59.999Z",
    });
    expect(ontarioDayUtcRange(new Date("2026-03-08T18:00:00.000Z"))).toEqual({
      start: "2026-03-08T05:00:00.000Z",
      end: "2026-03-09T03:59:59.999Z",
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
