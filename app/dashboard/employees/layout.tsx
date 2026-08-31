import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function EmployeesLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="employees">{children}</ModuleAccessLayout>;
}
