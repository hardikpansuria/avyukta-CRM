import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { EmployeesClient } from "./employees-client";

export default async function EmployeesPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/dashboard");
  }

  return <EmployeesClient />;
}
