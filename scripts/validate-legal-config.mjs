const requiredProductionValues = [
  "LEGAL_PRIVACY_CONTACT_EMAIL",
  "LEGAL_SECURITY_CONTACT_EMAIL",
  "LEGAL_EFFECTIVE_DATE",
  "LEGAL_CLIENT_DATA_RETENTION",
  "LEGAL_BACKUP_RETENTION",
  "LEGAL_LOG_RETENTION",
  "LEGAL_RESEND_RETENTION",
  "LEGAL_SUPABASE_REGION",
];

if (process.env.VERCEL_ENV === "production") {
  const missing = requiredProductionValues.filter(
    (name) => !process.env[name]?.trim(),
  );

  if (process.env.LEGAL_DOCUMENTS_APPROVED !== "true") {
    missing.push("LEGAL_DOCUMENTS_APPROVED=true");
  }

  if (missing.length > 0) {
    console.error(
      `Production legal configuration is incomplete: ${missing.join(", ")}`,
    );
    process.exit(1);
  }
}
