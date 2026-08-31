import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function EditCustomerLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="customers" action="edit">{children}</ModuleAccessLayout>;
}
