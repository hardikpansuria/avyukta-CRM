export const dashboardPeriods = ["today", "week", "month", "quarter", "year", "custom"] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

export type DashboardDateRange = {
  period: DashboardPeriod;
  from: string;
  to: string;
  label: string;
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function resolveDashboardDateRange(input: {
  period?: string;
  from?: string;
  to?: string;
}, now = new Date()): DashboardDateRange {
  const period = dashboardPeriods.includes(input.period as DashboardPeriod)
    ? (input.period as DashboardPeriod)
    : "month";
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start = new Date(end);
  let label = "This Month";

  if (period === "today") label = "Today";
  if (period === "week") {
    const day = start.getUTCDay();
    start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
    label = "This Week";
  }
  if (period === "month") start.setUTCDate(1);
  if (period === "quarter") {
    start = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3, 1));
    label = "This Quarter";
  }
  if (period === "year") {
    start = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
    label = "This Year";
  }
  if (period === "custom") {
    const valid = /^\d{4}-\d{2}-\d{2}$/;
    const from = valid.test(input.from ?? "") ? input.from! : isoDate(start);
    const to = valid.test(input.to ?? "") ? input.to! : isoDate(end);
    return { period, from: from <= to ? from : to, to: from <= to ? to : from, label: "Custom Range" };
  }

  return { period, from: isoDate(start), to: isoDate(end), label };
}

export function dateInRange(value: string | null | undefined, range: DashboardDateRange) {
  if (!value) return false;
  const date = value.slice(0, 10);
  return date >= range.from && date <= range.to;
}
