import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function PurchaseOrdersLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="purchase_orders">{children}</ModuleAccessLayout>;
}
