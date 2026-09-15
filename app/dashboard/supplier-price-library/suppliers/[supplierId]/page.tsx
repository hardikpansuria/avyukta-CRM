import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { SupplierDetailClient } from "./supplier-detail-client";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ supplierId: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const { supplierId } = await params;
  return <SupplierDetailClient supplierId={supplierId} />;
}
