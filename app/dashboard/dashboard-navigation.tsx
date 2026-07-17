"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileTextIcon,
  LayoutDashboardIcon,
  UsersIcon,
  UserRoundCogIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const iconByHref = {
  "/dashboard": LayoutDashboardIcon,
  "/dashboard/customers": UsersIcon,
  "/dashboard/quotations": FileTextIcon,
  "/dashboard/employees": UserRoundCogIcon,
};

export function DashboardNavigation({
  links,
  mobile = false,
}: {
  links: Array<{ href: string; label: string }>;
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={mobile ? "flex min-w-max gap-1" : "space-y-1"}
    >
      {links.map((link) => {
        const Icon =
          iconByHref[link.href as keyof typeof iconByHref] ??
          LayoutDashboardIcon;
        const isActive =
          link.href === "/dashboard"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-zinc-950 text-white shadow-sm dark:bg-zinc-50 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
              mobile && "whitespace-nowrap",
            )}
            href={link.href}
            key={link.href}
          >
            <Icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
