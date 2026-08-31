import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function NewInvoiceLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="invoices" action="create">{children}</ModuleAccessLayout>;
}
