import type { ReactNode } from "react";

import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function NewInvoiceRequestLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="invoice_requests" action="create">{children}</ModuleAccessLayout>;
}
