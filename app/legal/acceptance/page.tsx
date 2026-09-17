import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { verifyOrgSessionWithoutLegalGate } from "@/lib/auth/verify-org-session";
import { getLegalSiteConfiguration } from "@/lib/legal/config";
import { getRequiredLegalDocuments } from "@/lib/legal/documents";
import { getMissingRequiredLegalDocuments } from "@/lib/legal/acceptance";
import { safeLegalReturnPath } from "@/lib/legal/redirect";

import { AcceptanceForm } from "./acceptance-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Legal Review | Avyukta CRM",
  robots: { index: false, follow: false },
};

export default async function LegalAcceptancePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await verifyOrgSessionWithoutLegalGate();

  if (!session) {
    redirect("/login");
  }

  const returnPath = safeLegalReturnPath((await searchParams).next);
  const missing = await getMissingRequiredLegalDocuments(
    session.user.id,
    session.org_id,
  );

  if (missing.length === 0) {
    redirect(returnPath);
  }

  const configuration = getLegalSiteConfiguration();
  const requiredDocuments = getRequiredLegalDocuments();

  return (
    <AcceptanceForm
      configurationReady={configuration.ready}
      documents={requiredDocuments.map((document) => ({
        key: document.key,
        title: document.title,
        path: document.path,
        version: document.version,
        effectiveDate: document.effectiveDate,
      }))}
      returnPath={returnPath}
    />
  );
}
