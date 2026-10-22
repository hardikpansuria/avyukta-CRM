import { describe, expect, it } from "vitest";

import { canCreatePostAcceptanceRevision } from "./revision-eligibility";

describe("canCreatePostAcceptanceRevision", () => {
  it.each(["po_pending", "work_in_process"])(
    "allows accepted quotations for %s jobs",
    (jobStatus) => {
      expect(canCreatePostAcceptanceRevision("accepted", jobStatus)).toBe(true);
    },
  );

  it.each(["work_completed", "cancelled", "terminated", null, undefined])(
    "blocks accepted quotations for %s jobs",
    (jobStatus) => {
      expect(canCreatePostAcceptanceRevision("accepted", jobStatus)).toBe(false);
    },
  );

  it("blocks non-accepted quotations", () => {
    expect(canCreatePostAcceptanceRevision("sent", "work_in_process")).toBe(false);
  });
});
