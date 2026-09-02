"use client";

import { useEffect, useMemo, useState } from "react";

import { buildLegalAcceptanceCsv } from "@/lib/legal/acceptance-report-csv";
import type {
  LegalAcceptanceReportRow,
  LegalAcceptanceReportSummary,
  LegalReportStatus,
} from "@/lib/legal/acceptance-report";

type ReportPayload = {
  rows: LegalAcceptanceReportRow[];
  summary: LegalAcceptanceReportSummary;
};

const EMPTY_SUMMARY: LegalAcceptanceReportSummary = {
  total: 0,
  current: 0,
  action_required: 0,
  never_accepted: 0,
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: LegalReportStatus) {
  if (status === "current") return "Current";
  if (status === "action_required") return "Action required";
  return "Never accepted";
}

function statusClassName(status: LegalReportStatus) {
  if (status === "current") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (status === "action_required") {
    return "bg-amber-100 text-amber-800";
  }

  return "bg-zinc-200 text-zinc-700";
}

export default function LegalAcceptancesPage() {
  const [report, setReport] = useState<ReportPayload>({
    rows: [],
    summary: EMPTY_SUMMARY,
  });
  const [search, setSearch] = useState("");
  const [organizationId, setOrganizationId] = useState("all");
  const [legalStatus, setLegalStatus] = useState<LegalReportStatus | "all">(
    "all",
  );
  const [memberStatus, setMemberStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReport() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/super-admin/legal-acceptances", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<ReportPayload> & { error?: string })
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to load the report.");
        return;
      }

      setReport({
        rows: payload?.rows ?? [],
        summary: payload?.summary ?? EMPTY_SUMMARY,
      });
    } catch {
      setError("Unable to load the report.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => void loadReport());
  }, []);

  const organizations = useMemo(() => {
    const unique = new Map<string, string>();

    for (const row of report.rows) {
      unique.set(
        row.organization_id,
        `${row.organization_name} (${row.organization_code})`,
      );
    }

    return Array.from(unique, ([id, label]) => ({ id, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [report.rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return report.rows.filter((row) => {
      const matchesSearch =
        query.length === 0 ||
        row.full_name?.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        row.organization_name.toLowerCase().includes(query) ||
        row.organization_code.toLowerCase().includes(query);

      return (
        matchesSearch &&
        (organizationId === "all" ||
          row.organization_id === organizationId) &&
        (legalStatus === "all" || row.legal_status === legalStatus) &&
        (memberStatus === "all" || row.member_status === memberStatus)
      );
    });
  }, [legalStatus, memberStatus, organizationId, report.rows, search]);

  function exportCsv() {
    const csv = buildLegalAcceptanceCsv(filteredRows);
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const day = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `legal-acceptances-${day}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Legal Acceptance Report</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Audit each organization member against the current required legal
            document versions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isLoading}
            onClick={() => void loadReport()}
            type="button"
          >
            Refresh
          </button>
          <button
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            disabled={isLoading || filteredRows.length === 0}
            onClick={exportCsv}
            type="button"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Total members", report.summary.total, "text-zinc-950"],
          ["Current", report.summary.current, "text-emerald-700"],
          [
            "Action required",
            report.summary.action_required,
            "text-amber-700",
          ],
          ["Never accepted", report.summary.never_accepted, "text-zinc-700"],
        ].map(([label, value, className]) => (
          <section
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            key={String(label)}
          >
            <p className="text-sm font-medium text-zinc-500">{label}</p>
            <p className={`mt-2 text-3xl font-semibold ${className}`}>
              {value}
            </p>
          </section>
        ))}
      </div>

      <section className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Search</span>
            <input
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email, organization..."
              type="search"
              value={search}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              Organization
            </span>
            <select
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              onChange={(event) => setOrganizationId(event.target.value)}
              value={organizationId}
            >
              <option value="all">All organizations</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              Legal status
            </span>
            <select
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              onChange={(event) =>
                setLegalStatus(event.target.value as LegalReportStatus | "all")
              }
              value={legalStatus}
            >
              <option value="all">All statuses</option>
              <option value="current">Current</option>
              <option value="action_required">Action required</option>
              <option value="never_accepted">Never accepted</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">
              Member status
            </span>
            <select
              className="mt-2 h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
              onChange={(event) => setMemberStatus(event.target.value)}
              value={memberStatus}
            >
              <option value="all">All members</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Showing {filteredRows.length} of {report.rows.length} members. CSV
          export follows the active filters.
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-5 py-3 font-semibold">Organization</th>
                <th className="px-5 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold">Member</th>
                <th className="px-5 py-3 font-semibold">Legal status</th>
                <th className="px-5 py-3 font-semibold">Latest acceptance</th>
                <th className="px-5 py-3 font-semibold">Required documents</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {isLoading ? (
                <tr>
                  <td className="px-5 py-8 text-zinc-500" colSpan={7}>
                    Loading legal acceptance report...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-zinc-500" colSpan={7}>
                    No members match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.user_id}:${row.organization_id}`}>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-zinc-950">
                        {row.full_name || "Name not provided"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">{row.email}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-zinc-800">
                        {row.organization_name}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Code: {row.organization_code} · {row.organization_status}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top capitalize text-zinc-700">
                      {row.role}
                    </td>
                    <td className="px-5 py-4 align-top capitalize text-zinc-700">
                      {row.member_status}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClassName(row.legal_status)}`}
                      >
                        {statusLabel(row.legal_status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 align-top text-zinc-700">
                      {formatDate(row.latest_accepted_at)}
                    </td>
                    <td className="px-5 py-4 align-top">
                      <ul className="space-y-2">
                        {row.documents.map((document) => (
                          <li key={document.key}>
                            <p className="text-xs font-medium text-zinc-800">
                              {document.title} v{document.version}
                            </p>
                            <p className="mt-0.5 text-xs text-zinc-500">
                              {document.accepted_at
                                ? `${document.action_type} · ${formatDate(document.accepted_at)} · ${document.acceptance_source === "first_login_gate" ? "first login" : "version update"}`
                                : "Current version not accepted"}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
