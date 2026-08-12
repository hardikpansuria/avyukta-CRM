import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getSupplierPricePermissions } from "@/lib/auth/permissions";
import { CategoriesClient } from "./categories-client";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const query = await searchParams;
  const permissions = await getSupplierPricePermissions(session);

  return (
    <CategoriesClient
      permissions={permissions}
      initialCreating={permissions.canEdit && query.new === "1"}
    />
  );
}
