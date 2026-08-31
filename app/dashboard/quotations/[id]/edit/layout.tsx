import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function EditQuotationLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="quotations" action="edit">{children}</ModuleAccessLayout>;
}
