import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { UserManagementClient } from "./user-management-client";

export default async function UserManagementPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/dashboard");
  }

  return <UserManagementClient />;
}
