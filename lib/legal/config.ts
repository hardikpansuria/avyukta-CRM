export const LEGAL_DOCUMENT_VERSION = "1.0";
export const LEGAL_LAST_UPDATED = "2026-09-01";

const unresolvedValue = "Not configured for this non-production environment.";

const legalEnvironmentKeys = [
  "LEGAL_PRIVACY_CONTACT_EMAIL",
  "LEGAL_SECURITY_CONTACT_EMAIL",
  "LEGAL_EFFECTIVE_DATE",
  "LEGAL_CLIENT_DATA_RETENTION",
  "LEGAL_BACKUP_RETENTION",
  "LEGAL_LOG_RETENTION",
  "LEGAL_RESEND_RETENTION",
  "LEGAL_SUPABASE_REGION",
] as const;

export type LegalSiteConfiguration = {
  privacyContactEmail: string;
  securityContactEmail: string;
  effectiveDate: string;
  clientDataRetention: string;
  backupRetention: string;
  logRetention: string;
  resendRetention: string;
  supabaseRegion: string;
  approved: boolean;
  ready: boolean;
  unresolved: string[];
};

function configuredValue(name: (typeof legalEnvironmentKeys)[number]) {
  return process.env[name]?.trim() || unresolvedValue;
}

export function getLegalSiteConfiguration(): LegalSiteConfiguration {
  const unresolved: string[] = legalEnvironmentKeys.filter(
    (name) => !process.env[name]?.trim(),
  );
  const approved = process.env.LEGAL_DOCUMENTS_APPROVED === "true";

  if (!approved) {
    unresolved.push("LEGAL_DOCUMENTS_APPROVED=true");
  }

  return {
    privacyContactEmail: configuredValue("LEGAL_PRIVACY_CONTACT_EMAIL"),
    securityContactEmail: configuredValue("LEGAL_SECURITY_CONTACT_EMAIL"),
    effectiveDate: configuredValue("LEGAL_EFFECTIVE_DATE"),
    clientDataRetention: configuredValue("LEGAL_CLIENT_DATA_RETENTION"),
    backupRetention: configuredValue("LEGAL_BACKUP_RETENTION"),
    logRetention: configuredValue("LEGAL_LOG_RETENTION"),
    resendRetention: configuredValue("LEGAL_RESEND_RETENTION"),
    supabaseRegion: configuredValue("LEGAL_SUPABASE_REGION"),
    approved,
    ready: unresolved.length === 0,
    unresolved,
  };
}
