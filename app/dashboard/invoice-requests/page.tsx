import { redirect } from "next/navigation";

import { hasOrgPermission } from "@/lib/auth/permissions";
import { verifyOrgSession } from "@/lib/auth/verify-org-session";

import { InvoiceRequestsClient } from "./invoice-requests-client";

export default async function InvoiceRequestsPage() {
  const session = await verifyOrgSession();
  if (!session) redirect("/login");
  const canCreate = await hasOrgPermission(session, "invoice_requests", "create");
  return <InvoiceRequestsClient canCreate={canCreate} />;
}
