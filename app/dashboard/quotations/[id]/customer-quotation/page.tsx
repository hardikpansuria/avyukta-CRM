import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { createAdminClient } from "@/lib/supabase/admin";

import { CustomerQuotationWizard } from "./customer-quotation-wizard";

export default async function CustomerQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const admin = createAdminClient();
  const { data: quotation } = await admin
    .from("quotations")
    .select("is_locked")
    .eq("id", id)
    .eq("org_id", session.org_id)
    .maybeSingle();
  return <CustomerQuotationWizard readOnly={quotation?.is_locked === true} />;
}
