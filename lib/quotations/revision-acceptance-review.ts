import { moneyToCents } from "../invoices/exact-money";

type ReviewScope = {
  id: string;
  scope_title?: string | null;
  quantity?: number | string | null;
  scope_total_after_discount?: number | string | null;
  sort_order?: number | string | null;
};

export type RevisionScopeChange = {
  key: string;
  change_type: "added" | "removed" | "modified";
  title: string;
  previous_title: string | null;
  revised_title: string | null;
  previous_quantity: number;
  revised_quantity: number;
  previous_amount: number;
  revised_amount: number;
  amount_difference: number;
};

function numberValue(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedTitle(scope: ReviewScope) {
  return String(scope.scope_title ?? "").trim().toLocaleLowerCase();
}

function sortOrder(scope: ReviewScope) {
  return numberValue(scope.sort_order);
}

function hasChanged(previous: ReviewScope, revised: ReviewScope) {
  return (
    normalizedTitle(previous) !== normalizedTitle(revised) ||
    numberValue(previous.quantity) !== numberValue(revised.quantity) ||
    moneyToCents(previous.scope_total_after_discount ?? 0) !==
      moneyToCents(revised.scope_total_after_discount ?? 0)
  );
}

export function buildRevisionScopeChanges(
  previousScopes: ReviewScope[],
  revisedScopes: ReviewScope[],
): RevisionScopeChange[] {
  const unmatchedPrevious = new Set(previousScopes.map((_, index) => index));
  const unmatchedRevised = new Set(revisedScopes.map((_, index) => index));
  const matches: Array<[number, number]> = [];

  const matchWhere = (
    predicate: (previous: ReviewScope, revised: ReviewScope) => boolean,
  ) => {
    for (const previousIndex of [...unmatchedPrevious]) {
      const candidates = [...unmatchedRevised].filter((revisedIndex) =>
        predicate(previousScopes[previousIndex], revisedScopes[revisedIndex]),
      );
      if (candidates.length !== 1) continue;
      matches.push([previousIndex, candidates[0]]);
      unmatchedPrevious.delete(previousIndex);
      unmatchedRevised.delete(candidates[0]);
    }
  };

  // Cloned quotation revisions receive new scope IDs. Match the stable title
  // and order first, then fall back to a unique title or remaining order.
  matchWhere(
    (previous, revised) =>
      normalizedTitle(previous) === normalizedTitle(revised) &&
      sortOrder(previous) === sortOrder(revised),
  );
  matchWhere(
    (previous, revised) => normalizedTitle(previous) === normalizedTitle(revised),
  );
  matchWhere((previous, revised) => sortOrder(previous) === sortOrder(revised));

  const changes: RevisionScopeChange[] = [];
  for (const [previousIndex, revisedIndex] of matches) {
    const previous = previousScopes[previousIndex];
    const revised = revisedScopes[revisedIndex];
    if (!hasChanged(previous, revised)) continue;

    const previousAmount = numberValue(previous.scope_total_after_discount);
    const revisedAmount = numberValue(revised.scope_total_after_discount);
    changes.push({
      key: `modified-${previous.id}-${revised.id}`,
      change_type: "modified",
      title: revised.scope_title?.trim() || previous.scope_title?.trim() || "Untitled scope",
      previous_title: previous.scope_title?.trim() || null,
      revised_title: revised.scope_title?.trim() || null,
      previous_quantity: numberValue(previous.quantity),
      revised_quantity: numberValue(revised.quantity),
      previous_amount: previousAmount,
      revised_amount: revisedAmount,
      amount_difference: revisedAmount - previousAmount,
    });
  }

  for (const previousIndex of unmatchedPrevious) {
    const previous = previousScopes[previousIndex];
    const previousAmount = numberValue(previous.scope_total_after_discount);
    changes.push({
      key: `removed-${previous.id}`,
      change_type: "removed",
      title: previous.scope_title?.trim() || "Untitled scope",
      previous_title: previous.scope_title?.trim() || null,
      revised_title: null,
      previous_quantity: numberValue(previous.quantity),
      revised_quantity: 0,
      previous_amount: previousAmount,
      revised_amount: 0,
      amount_difference: -previousAmount,
    });
  }

  for (const revisedIndex of unmatchedRevised) {
    const revised = revisedScopes[revisedIndex];
    const revisedAmount = numberValue(revised.scope_total_after_discount);
    changes.push({
      key: `added-${revised.id}`,
      change_type: "added",
      title: revised.scope_title?.trim() || "Untitled scope",
      previous_title: null,
      revised_title: revised.scope_title?.trim() || null,
      previous_quantity: 0,
      revised_quantity: numberValue(revised.quantity),
      previous_amount: 0,
      revised_amount: revisedAmount,
      amount_difference: revisedAmount,
    });
  }

  return changes.sort((left, right) => left.key.localeCompare(right.key));
}

export function revisedTotalMatches(
  confirmation: unknown,
  revisedTotal: number | string | null | undefined,
) {
  if (typeof confirmation !== "string" && typeof confirmation !== "number") {
    return false;
  }

  try {
    return moneyToCents(confirmation) === moneyToCents(revisedTotal ?? 0);
  } catch {
    return false;
  }
}

export function validateRevisionPurpose(value: unknown) {
  if (typeof value !== "string") return "Purpose of revision is required";
  const purpose = value.trim();
  if (!purpose) return "Purpose of revision is required";
  if (purpose.length < 10 || (purpose.match(/[\p{L}\p{N}]/gu) ?? []).length < 5) {
    return "Enter a clear revision reason using at least 10 characters";
  }
  if (purpose.length > 1000) {
    return "Purpose of revision must be 1,000 characters or less";
  }
  return null;
}
