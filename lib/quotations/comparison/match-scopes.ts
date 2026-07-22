import { normalizeText, valuesEqual } from "./normalize-value";
import type {
  ComparisonCustomerItem,
  ComparisonRevision,
  ComparisonScope,
  ScopeComparisonRow,
} from "./types";

function itemForScope(revision: ComparisonRevision, scope: ComparisonScope) {
  return (
    revision.customerItems.find((item) => item.scopeId === scope.id) ??
    revision.customerItems.find(
      (item) =>
        normalizeText(item.title) === normalizeText(scope.title) &&
        item.sortOrder === scope.sortOrder,
    ) ??
    null
  );
}

function scopeChanged(
  left: ComparisonScope,
  right: ComparisonScope,
  itemA: ComparisonCustomerItem | null,
  itemB: ComparisonCustomerItem | null,
) {
  return ![
    valuesEqual(left.title, right.title),
    valuesEqual(left.quantity, right.quantity, "number"),
    valuesEqual(left.calculatedPriceEach, right.calculatedPriceEach, "number"),
    valuesEqual(left.scopeTotal, right.scopeTotal, "number"),
    valuesEqual(left.discountType, right.discountType),
    valuesEqual(left.discountValue, right.discountValue, "number"),
    valuesEqual(itemA?.descriptionText, itemB?.descriptionText),
    valuesEqual(itemA?.quantity, itemB?.quantity, "number"),
    valuesEqual(itemA?.priceEach, itemB?.priceEach, "number"),
    valuesEqual(itemA?.priceExt, itemB?.priceExt, "number"),
  ].every(Boolean);
}

export function matchRevisionScopes(
  revisionA: ComparisonRevision,
  revisionB: ComparisonRevision,
): ScopeComparisonRow[] {
  const unmatchedA = new Set(revisionA.scopes.map((_, index) => index));
  const unmatchedB = new Set(revisionB.scopes.map((_, index) => index));
  const matches: Array<[number, number]> = [];

  const matchWhere = (predicate: (a: ComparisonScope, b: ComparisonScope) => boolean) => {
    for (const aIndex of [...unmatchedA]) {
      const candidates = [...unmatchedB].filter((bIndex) =>
        predicate(revisionA.scopes[aIndex], revisionB.scopes[bIndex]),
      );
      if (candidates.length !== 1) continue;
      matches.push([aIndex, candidates[0]]);
      unmatchedA.delete(aIndex);
      unmatchedB.delete(candidates[0]);
    }
  };

  // Revision copies receive new scope IDs, so match exact title/order first,
  // then a unique title, and finally the same remaining sort position.
  matchWhere(
    (a, b) =>
      normalizeText(a.title) === normalizeText(b.title) &&
      a.sortOrder === b.sortOrder,
  );
  matchWhere((a, b) => normalizeText(a.title) === normalizeText(b.title));
  matchWhere((a, b) => a.sortOrder === b.sortOrder);

  const rows: ScopeComparisonRow[] = matches.map(([aIndex, bIndex]) => {
    const left = revisionA.scopes[aIndex];
    const right = revisionB.scopes[bIndex];
    const customerItemA = itemForScope(revisionA, left);
    const customerItemB = itemForScope(revisionB, right);
    return {
      key: `matched-${left.id}-${right.id}`,
      revisionA: left,
      revisionB: right,
      customerItemA,
      customerItemB,
      changeType: scopeChanged(left, right, customerItemA, customerItemB)
        ? "modified"
        : "unchanged",
    };
  });

  for (const aIndex of unmatchedA) {
    const scope = revisionA.scopes[aIndex];
    rows.push({
      key: `removed-${scope.id}`,
      revisionA: scope,
      revisionB: null,
      customerItemA: itemForScope(revisionA, scope),
      customerItemB: null,
      changeType: "removed",
    });
  }
  for (const bIndex of unmatchedB) {
    const scope = revisionB.scopes[bIndex];
    rows.push({
      key: `added-${scope.id}`,
      revisionA: null,
      revisionB: scope,
      customerItemA: null,
      customerItemB: itemForScope(revisionB, scope),
      changeType: "added",
    });
  }

  return rows.sort(
    (a, b) =>
      (a.revisionA?.sortOrder ?? a.revisionB?.sortOrder ?? 0) -
      (b.revisionA?.sortOrder ?? b.revisionB?.sortOrder ?? 0),
  );
}

