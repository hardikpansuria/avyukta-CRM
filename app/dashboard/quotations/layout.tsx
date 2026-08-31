import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function QuotationsLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="quotations">{children}</ModuleAccessLayout>;
}
