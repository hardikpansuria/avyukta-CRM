import type { ReactNode } from "react";

import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function InvoiceRequestsLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="invoice_requests">{children}</ModuleAccessLayout>;
}
