"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  ["/dashboard/supplier-price-library", "Overview"],
  ["/dashboard/supplier-price-library/materials", "Materials"],
  ["/dashboard/supplier-price-library/suppliers", "Suppliers"],
  ["/dashboard/supplier-price-library/categories", "Categories"],
] as const;

export function ModuleTabs() {
  const pathname = usePathname();
  return <div className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1">{links.map(([href, label]) => <Button key={href} nativeButton={false} size="sm" variant={pathname === href ? "default" : "ghost"} render={<Link href={href} />}>{label}</Button>)}</div>;
}

export function ModuleHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{actions}</div><ModuleTabs /></>;
}
