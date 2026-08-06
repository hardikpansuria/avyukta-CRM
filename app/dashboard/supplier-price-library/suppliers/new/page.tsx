import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canEditSupplierPriceLibrary } from "@/lib/supplier-price-library/access";

import { NewSupplierForm } from "./new-supplier-form";

export default async function NewSupplierPage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!canEditSupplierPriceLibrary(session.role)) {
    redirect("/dashboard/supplier-price-library/suppliers");
  }
  return <NewSupplierForm />;
}
