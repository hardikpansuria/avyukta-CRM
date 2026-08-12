import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { hasOrgPermission, type PermissionAction, type PermissionModule } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";

export async function ModuleAccessLayout({
  children,
  module,
  action = "view",
}: {
  children: ReactNode;
  module: PermissionModule;
  action?: PermissionAction;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!(await hasOrgPermission(session, module, action))) {
    redirect(`/dashboard/access-denied?module=${module}`);
  }
  return children;
}
