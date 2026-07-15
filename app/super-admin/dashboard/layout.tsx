import Link from "next/link";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { verifySuperAdmin } from "@/lib/auth/verify-super-admin";

import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

export default async function SuperAdminDashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const session = await verifySuperAdmin();

  if (!session) {
    redirect("/super-admin/login");
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white p-6 md:flex md:flex-col">
        <div>
          <p className="text-lg font-semibold">Super Admin</p>
          <p className="mt-1 text-sm text-zinc-500">{session.email}</p>
        </div>
        <nav className="mt-8 space-y-1">
          <Link
            className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
            href="/super-admin/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
            href="/super-admin/dashboard/organizations"
          >
            Organizations
          </Link>
        </nav>
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 md:hidden">
          <div>
            <p className="font-semibold">Super Admin</p>
            <p className="text-sm text-zinc-500">{session.email}</p>
          </div>
          <SignOutButton />
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
