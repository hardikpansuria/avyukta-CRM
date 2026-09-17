import type { AdminAuditChange } from "./types";

type AuditValues = Record<string, unknown>;

function displayValue(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function buildAuditChanges(
  before: AuditValues,
  after: AuditValues,
  labels: Record<string, string> = {},
): AdminAuditChange[] {
  return Object.keys(after).flatMap((key) => {
    const from = displayValue(before[key]);
    const to = displayValue(after[key]);
    if (from === to) return [];
    return [{ field: labels[key] ?? key, from, to }];
  });
}
