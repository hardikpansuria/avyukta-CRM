import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function NewCustomerLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="customers" action="create">{children}</ModuleAccessLayout>;
}
