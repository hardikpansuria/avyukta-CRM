import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { UserManagementClient } from "./user-management-client";

export default async function UserManagementPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  if (!(await hasOrgPermission(session, "settings", "manage"))) {
    redirect("/dashboard/access-denied?module=settings");
  }

  return <UserManagementClient />;
}
