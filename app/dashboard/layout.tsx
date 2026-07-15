import Link from "next/link";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { SignOutButton } from "./sign-out-button";

const roleLinks = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/dashboard/employees", label: "Employees" },
  ],
  accountant: [{ href: "/dashboard", label: "Dashboard" }],
  sales: [{ href: "/dashboard", label: "Dashboard" }],
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
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-200 bg-white p-6 md:flex md:flex-col">
        <div>
          <p className="text-lg font-semibold">{session.org_name}</p>
          <p className="mt-1 text-sm text-zinc-500">{session.org_code}</p>
        </div>
        <div className="mt-6 rounded-md bg-zinc-50 p-3 text-sm">
          <p className="font-medium text-zinc-950">{session.user.email}</p>
          <p className="mt-1 capitalize text-zinc-500">{session.role}</p>
        </div>
        <nav className="mt-8 space-y-1">
          {links.map((link) => (
            <Link
              className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 md:hidden">
          <div>
            <p className="font-semibold">{session.org_name}</p>
            <p className="text-sm text-zinc-500">
              {session.user.email} · {session.role}
            </p>
          </div>
          <SignOutButton />
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
