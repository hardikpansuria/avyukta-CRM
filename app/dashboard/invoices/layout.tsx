import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="invoices">{children}</ModuleAccessLayout>;
}
