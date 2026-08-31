import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const quotationStatuses = [
  ["draft", "Draft"],
  ["pending_approval", "Pending Approval"],
  ["sent", "Sent"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["converted_to_work_order", "Converted to Work Order"],
];

const statusClasses: Record<string, string> = {
  draft:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
  pending_approval:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  sent:
    "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300",
  accepted:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  rejected:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  expired:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300",
  converted_to_work_order:
    "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300",
};

export function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPlainDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatCurrency(value: number | string | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(numberValue);
}

export function QuotationStatusBadge({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) {
  const statusKey = status ?? "";

  return (
    <Badge
      className={cn(
        "h-6 rounded-full border px-2.5 font-medium shadow-none",
        statusClasses[statusKey] ??
          "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
        className,
      )}
      variant="outline"
    >
      {formatStatus(status)}
    </Badge>
  );
}

export function MoneyText({
  value,
  className,
}: {
  value: number | string | null | undefined;
  className?: string;
}) {
  return <span className={className}>{formatCurrency(value)}</span>;
}

export function DateText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  return <span className={className}>{formatPlainDate(value)}</span>;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-lg border-zinc-200 bg-white py-0 shadow-sm dark:border-zinc-800 dark:bg-zinc-950",
        className,
      )}
    >
      {title || description || action ? (
        <CardHeader className="rounded-t-lg border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {title ? (
                <CardTitle className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                  {title}
                </CardTitle>
              ) : null}
              {description ? (
                <CardDescription className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {description}
                </CardDescription>
              ) : null}
            </div>
            {action}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="px-5 py-5">{children}</CardContent>
    </Card>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50/60 px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900/30">
      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </p>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
