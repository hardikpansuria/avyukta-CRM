import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { CategoryDetailClient } from "./category-detail-client";

export default async function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const { categoryId } = await params;
  return <CategoryDetailClient categoryId={categoryId} />;
}
