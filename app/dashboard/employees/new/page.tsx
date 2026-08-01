import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canAccessEmployeeDirectory } from "@/lib/employees/access";

import { EmployeeForm } from "../employee-form";

export default async function NewEmployeePage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!canAccessEmployeeDirectory(session.role)) redirect("/dashboard");
  return <EmployeeForm />;
}
