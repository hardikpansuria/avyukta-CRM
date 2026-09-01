import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { getLegalDocumentBySlug } from "@/lib/legal/documents";

const publicLegalSlugs = new Set([
  "privacy",
  "terms",
  "acceptable-use",
  "cookies",
  "subprocessors",
  "open-source",
]);

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [...publicLegalSlugs].map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = getLegalDocumentBySlug(slug);

  if (!document || !publicLegalSlugs.has(slug)) {
    return {};
  }

  return {
    title: `${document.title} | Avyukta CRM`,
    description: document.description,
  };
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  const document = getLegalDocumentBySlug(slug);

  if (!document || !publicLegalSlugs.has(slug)) {
    notFound();
  }

  return <LegalDocumentView document={document} />;
}

export const dynamicParams = false;
