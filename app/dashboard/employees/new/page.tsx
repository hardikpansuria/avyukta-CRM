import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!(await hasOrgPermission(session, "employees", "create"))) {
    redirect("/dashboard/access-denied?module=employees");
  }
  return <EmployeeForm />;
}
