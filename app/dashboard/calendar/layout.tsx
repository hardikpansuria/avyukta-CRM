import type { ReactNode } from "react";
import { ModuleAccessLayout } from "@/app/dashboard/module-access-layout";

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <ModuleAccessLayout module="calendar">{children}</ModuleAccessLayout>;
}
