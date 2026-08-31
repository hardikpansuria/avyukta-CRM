import type { ChangeType } from "./types";
import { valuesEqual } from "./normalize-value";

export type ComparisonField = {
  label: string;
  revisionA: unknown;
  revisionB: unknown;
  kind?: "text" | "number" | "date";
  changeType?: ChangeType;
};

export function fieldChangeType(field: ComparisonField): ChangeType {
  if (field.changeType) return field.changeType;
  const leftMissing = field.revisionA === null || field.revisionA === undefined || field.revisionA === "";
  const rightMissing = field.revisionB === null || field.revisionB === undefined || field.revisionB === "";

  if (leftMissing && !rightMissing) return "added";
  if (!leftMissing && rightMissing) return "removed";
  return valuesEqual(field.revisionA, field.revisionB, field.kind)
    ? "unchanged"
    : "modified";
}
