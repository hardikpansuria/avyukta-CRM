import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { hasOrgPermission } from "@/lib/auth/permissions";

import { NewPriceForm } from "./new-price-form";

export default async function NewSupplierPricePage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!(await hasOrgPermission(session, "supplier_price_library", "create"))) {
    redirect("/dashboard/access-denied?module=supplier_price_library");
  }
  const { materialId } = await searchParams;
  return <NewPriceForm initialMaterialId={materialId ?? ""} />;
}
