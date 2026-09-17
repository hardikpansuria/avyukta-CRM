import {
  getRequiredLegalDocuments,
  type LegalActionType,
} from "./documents";

export type LegalAcceptanceRecord = {
  document_key: string;
  document_version: string;
  content_hash: string;
  action_type: LegalActionType;
};

export function findMissingRequiredDocuments(
  records: LegalAcceptanceRecord[],
  requiredDocuments = getRequiredLegalDocuments(),
) {
  return requiredDocuments.filter(
    (document) =>
      !records.some(
        (record) =>
          record.document_key === document.key &&
          record.document_version === document.version &&
          record.content_hash === document.contentHash &&
          record.action_type === document.actionType,
      ),
  );
}
