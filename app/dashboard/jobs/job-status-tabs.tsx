import Link from "next/link";

import { Button } from "@/components/ui/button";

type JobStatusTab = "po_pending" | "po_received" | "po_completed";

const tabs: Array<{ href: string; label: string; value: JobStatusTab }> = [
  {
    href: "/dashboard/jobs/po-pending",
    label: "PO Pending",
    value: "po_pending",
  },
  {
    href: "/dashboard/jobs/purchase-orders",
    label: "PO Received",
    value: "po_received",
  },
  {
    href: "/dashboard/jobs/completed",
    label: "PO Completed",
    value: "po_completed",
  },
];

export function JobStatusTabs({ active }: { active: JobStatusTab }) {
  return (
    <nav
      aria-label="Job status"
      className="flex flex-wrap gap-1 rounded-xl border bg-zinc-50 p-1 dark:bg-zinc-900/50"
    >
      {tabs.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Button
            className="min-w-28"
            key={tab.value}
            nativeButton={false}
            render={
              <Link
                aria-current={isActive ? "page" : undefined}
                href={tab.href}
              />
            }
            size="sm"
            variant={isActive ? "default" : "outline"}
          >
            {tab.label}
          </Button>
        );
      })}
    </nav>
  );
}
