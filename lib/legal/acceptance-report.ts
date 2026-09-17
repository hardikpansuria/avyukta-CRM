import {
  getRequiredLegalDocuments,
  type LegalActionType,
} from "./documents";

export type LegalReportStatus =
  | "current"
  | "action_required"
  | "never_accepted";

export type LegalReportOrganization = {
  id: string;
  name: string;
  org_code: string;
  status: string;
};

export type LegalReportMember = {
  user_id: string;
  org_id: string;
  role: string;
  status: string;
};

export type LegalReportProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

export type LegalReportEvidence = {
  user_id: string;
  organization_id: string;
  document_key: string;
  document_version: string;
  content_hash: string;
  action_type: LegalActionType;
  accepted_at: string;
  acceptance_source: "first_login_gate" | "version_update";
};

export type LegalReportDocument = {
  key: string;
  title: string;
  version: string;
  action_type: LegalActionType;
  accepted_at: string | null;
  acceptance_source: "first_login_gate" | "version_update" | null;
};

export type LegalAcceptanceReportRow = {
  user_id: string;
  full_name: string | null;
  email: string;
  organization_id: string;
  organization_name: string;
  organization_code: string;
  organization_status: string;
  role: string;
  member_status: string;
  legal_status: LegalReportStatus;
  latest_accepted_at: string | null;
  documents: LegalReportDocument[];
};

export type LegalAcceptanceReportSummary = {
  total: number;
  current: number;
  action_required: number;
  never_accepted: number;
};

type BuildReportInput = {
  organizations: LegalReportOrganization[];
  members: LegalReportMember[];
  profiles: LegalReportProfile[];
  evidence: LegalReportEvidence[];
};

function evidenceKey(userId: string, organizationId: string) {
  return `${userId}:${organizationId}`;
}

export function buildLegalAcceptanceReport({
  organizations,
  members,
  profiles,
  evidence,
}: BuildReportInput): {
  rows: LegalAcceptanceReportRow[];
  summary: LegalAcceptanceReportSummary;
} {
  const requiredDocuments = getRequiredLegalDocuments();
  const organizationsById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  const profilesById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const evidenceByMember = new Map<string, LegalReportEvidence[]>();

  for (const record of evidence) {
    const key = evidenceKey(record.user_id, record.organization_id);
    const existing = evidenceByMember.get(key) ?? [];
    existing.push(record);
    evidenceByMember.set(key, existing);
  }

  const rows = members.flatMap((member): LegalAcceptanceReportRow[] => {
    const organization = organizationsById.get(member.org_id);
    const profile = profilesById.get(member.user_id);

    if (!organization || !profile) {
      return [];
    }

    const memberEvidence = evidenceByMember.get(
      evidenceKey(member.user_id, member.org_id),
    ) ?? [];
    const documents = requiredDocuments.map((document): LegalReportDocument => {
      const currentRecord = memberEvidence.find(
        (record) =>
          record.document_key === document.key &&
          record.document_version === document.version &&
          record.content_hash === document.contentHash &&
          record.action_type === document.actionType,
      );

      return {
        key: document.key,
        title: document.title,
        version: document.version,
        action_type: document.actionType,
        accepted_at: currentRecord?.accepted_at ?? null,
        acceptance_source: currentRecord?.acceptance_source ?? null,
      };
    });
    const hasCurrentDocuments = documents.every(
      (document) => document.accepted_at !== null,
    );
    const legalStatus: LegalReportStatus = hasCurrentDocuments
      ? "current"
      : memberEvidence.length > 0
        ? "action_required"
        : "never_accepted";
    const latestAcceptedAt = memberEvidence.reduce<string | null>(
      (latest, record) =>
        latest === null || record.accepted_at > latest
          ? record.accepted_at
          : latest,
      null,
    );

    return [
      {
        user_id: member.user_id,
        full_name: profile.full_name,
        email: profile.email,
        organization_id: organization.id,
        organization_name: organization.name,
        organization_code: organization.org_code,
        organization_status: organization.status,
        role: member.role,
        member_status: member.status,
        legal_status: legalStatus,
        latest_accepted_at: latestAcceptedAt,
        documents,
      },
    ];
  });

  rows.sort(
    (left, right) =>
      left.organization_name.localeCompare(right.organization_name) ||
      (left.full_name ?? left.email).localeCompare(
        right.full_name ?? right.email,
      ),
  );

  return {
    rows,
    summary: {
      total: rows.length,
      current: rows.filter((row) => row.legal_status === "current").length,
      action_required: rows.filter(
        (row) => row.legal_status === "action_required",
      ).length,
      never_accepted: rows.filter(
        (row) => row.legal_status === "never_accepted",
      ).length,
    },
  };
}
