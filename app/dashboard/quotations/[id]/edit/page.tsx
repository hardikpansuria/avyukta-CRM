import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

import { QuotationForm } from "../../quotation-form";

export const dynamic = "force-dynamic";

function currentUserName(session: Awaited<ReturnType<typeof verifyOrgSession>>) {
  if (!session) {
    return "";
  }

  const metadataName = session.user.user_metadata?.full_name;
  return typeof metadataName === "string" && metadataName.trim()
    ? metadataName
    : (session.user.email ?? "Current user");
}

export default async function EditQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { data: quotation } = await admin
    .from("quotations")
    .select("is_locked")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();

  if (quotation?.is_locked) redirect(`/dashboard/quotations/${id}`);

  return (
    <QuotationForm
      currentUserName={currentUserName(session)}
      mode="edit"
      quotationId={id}
    />
  );
}
