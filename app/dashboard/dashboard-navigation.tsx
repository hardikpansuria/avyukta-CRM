"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusinessIcon,
  FileCheck2Icon,
  FileTextIcon,
  ClipboardListIcon,
  ReceiptTextIcon,
  LayoutDashboardIcon,
  UsersIcon,
  UserRoundCogIcon,
  ContactRoundIcon,
  CalendarDaysIcon,
  LibraryIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const iconByHref = {
  "/dashboard": LayoutDashboardIcon,
  "/dashboard/customers": UsersIcon,
  "/dashboard/quotations": FileTextIcon,
  "/dashboard/jobs": BriefcaseBusinessIcon,
  "/dashboard/jobs/po-pending": FileCheck2Icon,
  "/dashboard/jobs/purchase-orders": ReceiptTextIcon,
  "/dashboard/invoices": ReceiptTextIcon,
  "/dashboard/invoice-requests": ClipboardListIcon,
  "/dashboard/employees": ContactRoundIcon,
  "/dashboard/calendar": CalendarDaysIcon,
  "/dashboard/supplier-price-library": LibraryIcon,
  "/dashboard/user-management": UserRoundCogIcon,
};

export function DashboardNavigation({
  links,
  mobile = false,
}: {
  links: Array<{
    href: string;
    label: string;
    children?: Array<{ href: string; label: string; module: string }>;
  }>;
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
          <div key={link.href}>
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
          >
            <Icon className="size-4" />
            {link.label}
            </Link>
            {link.children && isActive ? (
              <div
                className={cn(
                  mobile
                    ? "ml-1 inline-flex gap-1"
                    : "ml-5 mt-1 space-y-1 border-l border-zinc-200 pl-2 dark:border-zinc-800",
                )}
              >
                {link.children.map((child) => {
                  const ChildIcon =
                    iconByHref[child.href as keyof typeof iconByHref] ??
                    FileTextIcon;
                  const childActive =
                    pathname === child.href ||
                    pathname.startsWith(`${child.href}/`);
                  return (
                    <Link
                      aria-current={childActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition",
                        childActive
                          ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                        mobile && "whitespace-nowrap",
                      )}
                      href={child.href}
                      key={child.href}
                    >
                      <ChildIcon className="size-3.5" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
