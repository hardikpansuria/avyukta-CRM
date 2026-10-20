import { describe, expect, it } from "vitest";

import { canCreatePostAcceptanceRevision } from "./revision-eligibility";

describe("post-acceptance quotation revision eligibility", () => {
  it.each(["po_pending", "work_in_process", "on_hold"])(
    "allows an accepted quotation while its job is %s",
    (jobStatus) => {
      expect(canCreatePostAcceptanceRevision("accepted", jobStatus)).toBe(true);
    },
  );

  it.each(["work_completed", "cancelled", "terminated", null])(
    "blocks an accepted quotation while its job is %s",
    (jobStatus) => {
      expect(canCreatePostAcceptanceRevision("accepted", jobStatus)).toBe(false);
    },
  );

  it("does not treat an ordinary sent quotation as post-acceptance", () => {
    expect(canCreatePostAcceptanceRevision("sent", "work_in_process")).toBe(
      false,
    );
  });
});
