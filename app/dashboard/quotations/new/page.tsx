import { redirect } from "next/navigation";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { QuotationForm } from "../quotation-form";

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

export default async function NewQuotationPage() {
  const session = await verifyOrgSession();

  if (!session) {
    redirect("/login");
  }

  return <QuotationForm currentUserName={currentUserName(session)} mode="new" />;
}
