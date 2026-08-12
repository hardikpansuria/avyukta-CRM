import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { EmployeeForm } from "../../employee-form";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!(await hasOrgPermission(session, "employees", "edit"))) {
    redirect("/dashboard/access-denied?module=employees");
  }
  const { employeeId } = await params;
  return <EmployeeForm employeeId={employeeId} />;
}
