"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminAuditLog } from "@/lib/admin-audit/types";

const moduleLabels: Record<AdminAuditLog["module_key"], string> = {
  company_branding: "Company Branding",
  invite_employee: "Invite Employee",
  crm_users: "CRM Users",
  module_permissions: "Module Permissions",
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function AdminAuditLogs({ refreshKey }: { refreshKey: number }) {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void fetch(`/api/org/admin-audit-logs?page=${page}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as
          | {
              logs?: AdminAuditLog[];
              pagination?: { totalPages?: number };
              error?: string;
            }
          | null;
        if (!response.ok) throw new Error(payload?.error ?? "Unable to load logs.");
        if (cancelled) return;
        setLogs(payload?.logs ?? []);
        setTotalPages(payload?.pagination?.totalPages ?? 1);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load logs.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-6 py-4">
        <h2 className="text-lg font-semibold">Administrator Logs</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Critical changes made in Admin Settings, newest first.
        </p>
      </div>

      {isLoading ? (
        <p className="px-6 py-8 text-sm text-zinc-500">Loading logs...</p>
      ) : error ? (
        <p className="m-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : logs.length === 0 ? (
        <p className="px-6 py-8 text-sm text-zinc-500">No administrator actions have been logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-3 font-semibold">Timestamp</th>
                <th className="px-6 py-3 font-semibold">Admin</th>
                <th className="px-6 py-3 font-semibold">Action</th>
                <th className="px-6 py-3 font-semibold">Section</th>
                <th className="px-6 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {logs.map((log) => (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap px-6 py-4 text-zinc-600">{formatTimestamp(log.created_at)}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-950">{log.actor_name}</p>
                    <p className="text-xs text-zinc-500">{log.actor_email ?? "—"}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={log.action_type === "delete" ? "destructive" : "secondary"} className="capitalize">
                      {log.action_type}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">{moduleLabels[log.module_key]}</td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{log.summary}</p>
                    {log.target_label ? <p className="mt-1 text-xs text-zinc-500">Target: {log.target_label}</p> : null}
                    {log.changes.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-zinc-600">
                        {log.changes.map((change, index) => (
                          <li key={`${log.id}-${change.field}-${index}`}>
                            <span className="font-medium">{change.field}:</span>{" "}
                            {change.from ?? "Not set"} → {change.to ?? "Not set"}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
          <p className="text-sm text-zinc-600">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={page >= totalPages || isLoading} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
