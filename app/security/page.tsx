import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { getLegalDocumentBySlug } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Security Overview | Avyukta CRM",
  description: "Verified safeguards and responsible security reporting.",
};

export default function SecurityPage() {
  const document = getLegalDocumentBySlug("security");

  if (!document) {
    return null;
  }

  return <LegalDocumentView document={document} />;
}
