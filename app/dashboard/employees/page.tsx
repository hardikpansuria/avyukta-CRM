import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const [canCreate, canEdit, canDelete] = await Promise.all([
    hasOrgPermission(session, "employees", "create"),
    hasOrgPermission(session, "employees", "edit"),
    hasOrgPermission(session, "employees", "delete"),
  ]);
  return (
    <EmployeesClient
      canCreate={canCreate}
      canDelete={canDelete}
      canEdit={canEdit}
    />
  );
}
