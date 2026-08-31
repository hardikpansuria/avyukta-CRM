import type { PermissionKey } from "@/lib/auth/permissions";

export type DashboardKind = "owner" | "sales" | "accountant" | "operations";
export type DashboardScope = "company" | "current_user" | "financial";

export type DashboardWidgetDefinition = {
  id: string;
  title: string;
  permission: PermissionKey;
  scope: DashboardScope;
  destination: string;
};

const roleDashboardMap: Record<string, DashboardKind> = {
  owner: "owner",
  org_admin: "owner",
  admin: "owner",
  sales: "sales",
  salesperson: "sales",
  accountant: "accountant",
};

export function dashboardKindForRole(role: string): DashboardKind {
  return roleDashboardMap[role.toLowerCase()] ?? "operations";
}

export const dashboardWidgets: Record<DashboardKind, DashboardWidgetDefinition[]> = {
  owner: [
    { id: "executive-summary", title: "Executive Summary", permission: "dashboard.view", scope: "company", destination: "/dashboard" },
    { id: "attention", title: "Needs Your Attention", permission: "dashboard.view", scope: "company", destination: "/dashboard" },
    { id: "sales-overview", title: "Sales Overview", permission: "quotations.view", scope: "company", destination: "/dashboard/quotations" },
    { id: "jobs", title: "Jobs Currently On The Go", permission: "jobs.view", scope: "company", destination: "/dashboard/jobs/purchase-orders" },
    { id: "financial", title: "Financial Overview", permission: "invoices.view", scope: "financial", destination: "/dashboard/invoices" },
  ],
  sales: [
    { id: "my-sales", title: "My Sales", permission: "quotations.view", scope: "current_user", destination: "/dashboard/quotations" },
    { id: "priorities", title: "My Priorities", permission: "dashboard.view", scope: "current_user", destination: "/dashboard" },
    { id: "company-operations", title: "Company Operations", permission: "jobs.view", scope: "company", destination: "/dashboard/jobs/purchase-orders" },
    { id: "company-history", title: "Company History", permission: "jobs.view", scope: "company", destination: "/dashboard/jobs/completed" },
  ],
  accountant: [
    { id: "financial-summary", title: "Financial Summary", permission: "invoices.view", scope: "financial", destination: "/dashboard/invoices" },
    { id: "ready-to-invoice", title: "Ready to Invoice", permission: "invoice_requests.view", scope: "financial", destination: "/dashboard/invoice-requests" },
    { id: "receivables", title: "Customers Who Owe Us Money", permission: "invoices.view", scope: "financial", destination: "/dashboard/invoices/outstanding" },
  ],
  operations: [
    { id: "company-operations", title: "Company Operations", permission: "jobs.view", scope: "company", destination: "/dashboard/jobs/purchase-orders" },
    { id: "recent-activity", title: "Recent Company Activity", permission: "dashboard.view", scope: "company", destination: "/dashboard" },
  ],
};

export function visibleDashboardWidgets(
  kind: DashboardKind,
  permissions: ReadonlySet<PermissionKey>,
) {
  return dashboardWidgets[kind].filter((widget) => permissions.has(widget.permission));
}
