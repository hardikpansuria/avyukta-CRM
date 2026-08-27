"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardDateRange, DashboardPeriod } from "@/lib/dashboard/date-range";

export function DashboardDateFilter({ range }: { range: DashboardDateRange }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const update = (period: DashboardPeriod) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    if (period !== "custom") { params.delete("from"); params.delete("to"); }
    router.push(`${pathname}?${params.toString()}`);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select onValueChange={(value) => update(value as DashboardPeriod)} value={range.period}>
        <SelectTrigger aria-label="Dashboard date range" className="h-10 w-44 bg-background"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem><SelectItem value="week">This Week</SelectItem><SelectItem value="month">This Month</SelectItem>
          <SelectItem value="quarter">This Quarter</SelectItem><SelectItem value="year">This Year</SelectItem><SelectItem value="custom">Custom Range</SelectItem>
        </SelectContent>
      </Select>
      {range.period === "custom" ? (
        <form className="flex items-center gap-2" method="get">
          <input name="period" type="hidden" value="custom" />
          <input aria-label="Start date" className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={range.from} name="from" type="date" />
          <span className="text-sm text-muted-foreground">to</span>
          <input aria-label="End date" className="h-10 rounded-md border bg-background px-2 text-sm" defaultValue={range.to} name="to" type="date" />
          <button className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" type="submit">Apply</button>
        </form>
      ) : null}
    </div>
  );
}
