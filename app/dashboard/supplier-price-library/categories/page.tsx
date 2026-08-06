import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import {
  canViewSupplierPriceLibrary,
  supplierPricePermissions,
} from "@/lib/supplier-price-library/access";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  if (!canViewSupplierPriceLibrary(session.role)) redirect("/dashboard");
  const query = await searchParams;
  const permissions = supplierPricePermissions(session.role);

  return (
    <CategoriesClient
      permissions={permissions}
      initialCreating={permissions.canEdit && query.new === "1"}
    />
  );
}
