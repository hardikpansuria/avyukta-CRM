import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { canEditSupplierPriceLibrary } from "@/lib/supplier-price-library/access";

import { NewPriceForm } from "./new-price-form";

export default async function NewSupplierPricePage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!canEditSupplierPriceLibrary(session.role)) {
    redirect("/dashboard/supplier-price-library");
  }
  const { materialId } = await searchParams;
  return <NewPriceForm initialMaterialId={materialId ?? ""} />;
}
