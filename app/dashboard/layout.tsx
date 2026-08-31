import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getEffectivePermissionKeys, type PermissionModule } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { isOrgScopedStoragePath } from "@/lib/supabase/storage-path";

import { AccessDeniedWarning } from "./access-denied-warning";
import { DashboardNavigation } from "./dashboard-navigation";
import { OrganizationLogo } from "./organization-logo";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

type DashboardLink = {
  href: string;
  label: string;
  module: PermissionModule;
  children?: Array<{ href: string; label: string; module: PermissionModule }>;
};

const dashboardLinks: DashboardLink[] = [
    { href: "/dashboard", label: "Dashboard", module: "dashboard" },
    { href: "/dashboard/customers", label: "Customers", module: "customers" },
    { href: "/dashboard/quotations", label: "Quotations", module: "quotations" },
    {
      href: "/dashboard/jobs",
      label: "Job on the Go",
      module: "jobs",
      children: [
        { href: "/dashboard/jobs/po-pending", label: "PO Pending", module: "jobs" },
        { href: "/dashboard/jobs/purchase-orders", label: "PO Received", module: "purchase_orders" },
        { href: "/dashboard/jobs/completed", label: "Job Completed", module: "jobs" },
      ],
    },
    { href: "/dashboard/invoices", label: "Invoice", module: "invoices" },
    { href: "/dashboard/employees", label: "Employee List", module: "employees" },
    { href: "/dashboard/calendar", label: "Public Calendar", module: "calendar" },
    {
      href: "/dashboard/supplier-price-library",
      label: "Supplier Price Library",
      module: "supplier_price_library",
      children: [
        { href: "/dashboard/supplier-price-library/suppliers", label: "Suppliers", module: "supplier_price_library" },
        { href: "/dashboard/supplier-price-library/categories", label: "Categories", module: "supplier_price_library" },
        { href: "/dashboard/supplier-price-library/materials", label: "Materials", module: "supplier_price_library" },
      ],
    },
    { href: "/dashboard/user-management", label: "Settings", module: "settings" },
];

async function organizationLogoUrl(
  orgId: string,
  logoStoragePath: string | null | undefined,
) {
  if (!logoStoragePath || !isOrgScopedStoragePath(logoStoragePath, orgId)) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("crm-assets")
    .createSignedUrl(logoStoragePath, 60 * 60);

  return error ? null : data.signedUrl;
}

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/auth/session-expired");
  }

  const [permissions, logoUrl] = await Promise.all([
    getEffectivePermissionKeys(session),
    organizationLogoUrl(session.org_id, session.logo_storage_path),
  ]);
  const links = dashboardLinks
    .filter((link) =>
      permissions.has(
        link.module === "settings" ? "settings.manage" : `${link.module}.view`,
      ),
    )
    .map((link) => ({
      ...link,
      children: link.children?.filter((child) =>
        permissions.has(`${child.module}.view`),
      ),
    }));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-24 items-center gap-3 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <OrganizationLogo name={session.org_name} src={logoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{session.org_name}</p>
            <p className="mt-0.5 truncate text-xs uppercase text-zinc-500 dark:text-zinc-400">
              {session.org_code}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-xs font-medium uppercase text-zinc-400 dark:text-zinc-500">
            Workspace
          </p>
          <DashboardNavigation links={links} />
        </div>
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-3 min-w-0 px-1">
            <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
              {session.user.email}
            </p>
            <p className="mt-0.5 text-xs capitalize text-zinc-500 dark:text-zinc-400">
              {session.role}
            </p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="md:pl-64">
        <AccessDeniedWarning />
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex h-24 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <OrganizationLogo name={session.org_name} src={logoUrl} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {session.org_name}
                </p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {session.user.email}
                </p>
              </div>
            </div>
            <SignOutButton compact />
          </div>
          <div className="overflow-x-auto border-t border-zinc-100 px-3 py-2 dark:border-zinc-900">
            <DashboardNavigation links={links} mobile />
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
