import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { NewSupplierForm } from "./new-supplier-form";

export default async function NewSupplierPage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!(await hasOrgPermission(session, "supplier_price_library", "create"))) {
    redirect("/dashboard/access-denied?module=supplier_price_library");
  }
  return <NewSupplierForm />;
}
