import { describe, expect, it } from "vitest";

import { isPendingInvitation } from "./invitation-status";

describe("isPendingInvitation", () => {
  it("identifies an invited user who has not accepted the invitation", () => {
    expect(
      isPendingInvitation({
        invited_at: "2026-08-26T20:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("does not mark an accepted invitation as pending", () => {
    expect(
      isPendingInvitation({
        invited_at: "2026-08-26T20:00:00.000Z",
        confirmed_at: "2026-08-26T20:05:00.000Z",
        email_confirmed_at: "2026-08-26T20:05:00.000Z",
      }),
    ).toBe(false);
  });

  it("does not classify a normal unconfirmed signup as an invitation", () => {
    expect(isPendingInvitation({})).toBe(false);
  });
});
