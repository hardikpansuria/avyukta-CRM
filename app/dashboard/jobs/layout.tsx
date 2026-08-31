import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function JobsLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="jobs">{children}</ModuleAccessLayout>;
}
