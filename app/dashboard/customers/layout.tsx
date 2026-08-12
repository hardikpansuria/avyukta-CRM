import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function CustomersLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="customers">{children}</ModuleAccessLayout>;
}
