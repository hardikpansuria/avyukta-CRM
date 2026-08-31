export function normalizeText(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

export function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replaceAll(",", "").replace(/[$%]/g, "").trim());
  return Number.isFinite(numberValue)
    ? Math.round((numberValue + Number.EPSILON) * 10000) / 10000
    : null;
}

export function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toISOString().slice(0, 10);
}

export function valuesEqual(
  revisionA: unknown,
  revisionB: unknown,
  kind: "text" | "number" | "date" = "text",
) {
  if (kind === "number") {
    return normalizeMoney(revisionA) === normalizeMoney(revisionB);
  }
  if (kind === "date") {
    return normalizeDate(revisionA) === normalizeDate(revisionB);
  }
  return normalizeText(revisionA) === normalizeText(revisionB);
}

