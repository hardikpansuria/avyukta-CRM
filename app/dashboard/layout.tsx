import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { DashboardNavigation } from "./dashboard-navigation";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

const roleLinks = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/customers", label: "Customers" },
    { href: "/dashboard/quotations", label: "Quotations" },
    { href: "/dashboard/employees", label: "Employees" },
  ],
  accountant: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/customers", label: "Customers" },
    { href: "/dashboard/quotations", label: "Quotations" },
  ],
  sales: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/customers", label: "Customers" },
    { href: "/dashboard/quotations", label: "Quotations" },
  ],
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  const links = roleLinks[session.role as keyof typeof roleLinks] ?? [
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-200 bg-white md:flex md:flex-col dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-200 px-5 dark:border-zinc-800">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
            A
          </div>
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
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur md:hidden dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex h-16 items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-sm font-semibold text-white dark:bg-zinc-50 dark:text-zinc-950">
                A
              </div>
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
