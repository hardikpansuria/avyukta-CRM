"use client";

import Link from "next/link";
import {
  CalendarDaysIcon,
  CircleDollarSignIcon,
  FilePlus2Icon,
  FileTextIcon,
  PlusIcon,
  ReceiptTextIcon,
  ZapIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FloatingQuickAction = {
  label: string;
  href: string;
  icon: "customer" | "quotation" | "po" | "invoice" | "payment" | "calendar";
};

const icons = {
  customer: PlusIcon,
  quotation: FilePlus2Icon,
  po: FileTextIcon,
  invoice: ReceiptTextIcon,
  payment: CircleDollarSignIcon,
  calendar: CalendarDaysIcon,
};

export function FloatingQuickActions({ actions }: { actions: FloatingQuickAction[] }) {
  if (!actions.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Open quick actions"
          render={
            <Button className="h-12 rounded-full px-3 shadow-lg ring-1 ring-background/80 sm:px-4" />
          }
        >
          <ZapIcon className="size-5" />
          <span className="hidden sm:inline">Quick Actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 rounded-xl p-2"
          side="top"
          sideOffset={10}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-foreground">
              Quick Actions
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {actions.map((action) => {
              const Icon = icons[action.icon];
              return (
                <DropdownMenuItem
                  className="rounded-lg py-2.5"
                  key={action.label}
                  render={<Link href={action.href} />}
                >
                  <Icon className="size-4 text-muted-foreground" />
                  {action.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
