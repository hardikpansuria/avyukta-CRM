import type { LegalAcceptanceReportRow } from "./acceptance-report";

function csvCell(value: string | number | null) {
  let normalized = value === null ? "" : String(value);

  if (/^[=+\-@]/.test(normalized)) {
    normalized = `'${normalized}`;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

export function buildLegalAcceptanceCsv(rows: LegalAcceptanceReportRow[]) {
  const headings = [
    "Name",
    "Email",
    "Organization",
    "Org Code",
    "Organization Status",
    "Role",
    "Member Status",
    "Legal Status",
    "Latest Acceptance",
    "Current Documents",
  ];
  const lines = rows.map((row) => [
    row.full_name ?? "",
    row.email,
    row.organization_name,
    row.organization_code,
    row.organization_status,
    row.role,
    row.member_status,
    row.legal_status,
    row.latest_accepted_at,
    row.documents
      .map(
        (document) =>
          `${document.title} v${document.version}: ${document.accepted_at ?? "not current"}${document.acceptance_source ? ` (${document.acceptance_source})` : ""}`,
      )
      .join("; "),
  ]);

  return [headings, ...lines]
    .map((line) => line.map((value) => csvCell(value)).join(","))
    .join("\r\n");
}
