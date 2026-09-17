import { describe, expect, it } from "vitest";

import { buildAuditChanges } from "./changes";

describe("buildAuditChanges", () => {
  it("keeps only changed fields with readable labels", () => {
    expect(
      buildAuditChanges(
        { role: "sales", status: "active" },
        { role: "accountant", status: "active" },
        { role: "Role", status: "Status" },
      ),
    ).toEqual([{ field: "Role", from: "sales", to: "accountant" }]);
  });

  it("normalizes empty and boolean values for display", () => {
    expect(buildAuditChanges({ phone: "", allowed: false }, { phone: "555", allowed: true })).toEqual([
      { field: "phone", from: null, to: "555" },
      { field: "allowed", from: "No", to: "Yes" },
    ]);
  });
});
