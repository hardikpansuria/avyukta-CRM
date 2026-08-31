import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function NewQuotationLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="quotations" action="create">{children}</ModuleAccessLayout>;
}
