import { describe, expect, it } from "vitest";

import {
  buildRevisionScopeChanges,
  revisedTotalMatches,
  validateRevisionPurpose,
} from "./revision-acceptance-review";

describe("revision acceptance review", () => {
  it("summarizes modified, added, and removed scopes", () => {
    const changes = buildRevisionScopeChanges(
      [
        { id: "old-tanks", scope_title: "Tanks", quantity: 13, scope_total_after_discount: "13000.00", sort_order: 0 },
        { id: "old-pipe", scope_title: "Pipe", quantity: 1, scope_total_after_discount: "500.00", sort_order: 1 },
      ],
      [
        { id: "new-tanks", scope_title: "Tanks", quantity: 15, scope_total_after_discount: "15000.00", sort_order: 0 },
        { id: "new-table", scope_title: "Table", quantity: 1, scope_total_after_discount: "2000.00", sort_order: 2 },
      ],
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ change_type: "modified", title: "Tanks", amount_difference: 2000 }),
        expect.objectContaining({ change_type: "removed", title: "Pipe", amount_difference: -500 }),
        expect.objectContaining({ change_type: "added", title: "Table", amount_difference: 2000 }),
      ]),
    );
  });

  it("omits unchanged scopes", () => {
    expect(
      buildRevisionScopeChanges(
        [{ id: "old", scope_title: "Tank", quantity: 1, scope_total_after_discount: "1000.00", sort_order: 0 }],
        [{ id: "new", scope_title: "Tank", quantity: 1, scope_total_after_discount: "1000.00", sort_order: 0 }],
      ),
    ).toEqual([]);
  });

  it("requires an exact cents match for final acceptance", () => {
    expect(revisedTotalMatches("17000", "17000.00")).toBe(true);
    expect(revisedTotalMatches("17000.01", "17000.00")).toBe(false);
    expect(revisedTotalMatches("17,000", "17000.00")).toBe(false);
    expect(revisedTotalMatches("", "17000.00")).toBe(false);
  });

  it("requires a meaningful revision reason", () => {
    expect(validateRevisionPurpose("Price and scope increased by customer request")).toBeNull();
    expect(validateRevisionPurpose("short")).toMatch(/at least 10 characters/);
    expect(validateRevisionPurpose("----------")).toMatch(/at least 10 characters/);
  });
});
