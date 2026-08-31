import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function AttachPurchaseOrderLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="purchase_orders" action="attach_po">{children}</ModuleAccessLayout>;
}
