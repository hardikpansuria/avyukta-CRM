import { createAdminClient } from "@/lib/supabase/admin";

import {
  getRequiredLegalDocuments,
  type LegalDocument,
} from "./documents";
import {
  findMissingRequiredDocuments,
  type LegalAcceptanceRecord,
} from "./acceptance-state";

export async function getMissingRequiredLegalDocuments(
  userId: string,
  organizationId: string,
): Promise<Array<LegalDocument & { actionType: "agreed" | "acknowledged" }>> {
  const requiredDocuments = getRequiredLegalDocuments();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("legal_acceptances")
    .select("document_key, document_version, content_hash, action_type")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .in(
      "document_key",
      requiredDocuments.map((document) => document.key),
    );

  if (error) {
    throw new Error("Unable to verify legal acceptance status", {
      cause: error,
    });
  }

  return findMissingRequiredDocuments(
    (data ?? []) as LegalAcceptanceRecord[],
    requiredDocuments,
  );
}

export async function hasCurrentLegalAcceptance(
  userId: string,
  organizationId: string,
) {
  return (
    (await getMissingRequiredLegalDocuments(userId, organizationId)).length ===
    0
  );
}
