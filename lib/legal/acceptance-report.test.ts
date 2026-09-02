import { describe, expect, it } from "vitest";

import { buildLegalAcceptanceCsv } from "./acceptance-report-csv";
import {
  buildLegalAcceptanceReport,
  type LegalReportEvidence,
} from "./acceptance-report";
import { getRequiredLegalDocuments } from "./documents";

const organizations = [
  { id: "org-1", name: "ProTech", org_code: "4455", status: "active" },
];
const profiles = [
  { id: "user-current", email: "current@example.com", full_name: "Hardik" },
  { id: "user-stale", email: "stale@example.com", full_name: "A User" },
  { id: "user-new", email: "new@example.com", full_name: null },
];
const members = profiles.map((profile) => ({
  user_id: profile.id,
  org_id: "org-1",
  role: "sales",
  status: "active",
}));

function currentEvidence(userId: string): LegalReportEvidence[] {
  return getRequiredLegalDocuments().map((document, index) => ({
    user_id: userId,
    organization_id: "org-1",
    document_key: document.key,
    document_version: document.version,
    content_hash: document.contentHash,
    action_type: document.actionType,
    accepted_at: `2026-09-02T10:0${index}:00.000Z`,
    acceptance_source: "first_login_gate",
  }));
}

describe("legal acceptance report", () => {
  it("classifies current, stale, and never-accepted members", () => {
    const evidence = [
      ...currentEvidence("user-current"),
      {
        ...currentEvidence("user-stale")[0],
        user_id: "user-stale",
        document_version: "0.9",
      },
    ];
    const report = buildLegalAcceptanceReport({
      organizations,
      profiles,
      members,
      evidence,
    });

    expect(report.summary).toEqual({
      total: 3,
      current: 1,
      action_required: 1,
      never_accepted: 1,
    });
    expect(
      report.rows.find((row) => row.user_id === "user-current")?.legal_status,
    ).toBe("current");
    expect(
      report.rows.find((row) => row.user_id === "user-stale")?.legal_status,
    ).toBe("action_required");
    expect(
      report.rows.find((row) => row.user_id === "user-new")?.legal_status,
    ).toBe("never_accepted");
  });

  it("exports filtered rows and neutralizes spreadsheet formulas", () => {
    const report = buildLegalAcceptanceReport({
      organizations: [
        { ...organizations[0], name: "=FORMULA()" },
      ],
      profiles: [profiles[0]],
      members: [members[0]],
      evidence: currentEvidence("user-current"),
    });
    const csv = buildLegalAcceptanceCsv(report.rows);

    expect(csv).toContain("Legal Status");
    expect(csv).toContain("'=FORMULA()");
    expect(csv).toContain("current@example.com");
  });
});
