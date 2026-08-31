import { describe, expect, it } from "vitest";

import { shouldClearExpiredSessionCookie } from "./session-cookies";

describe("shouldClearExpiredSessionCookie", () => {
  it.each([
    "org_context",
    "sa_context",
    "sb-projectref-auth-token",
    "sb-projectref-auth-token.0",
    "sb-projectref-auth-token.12",
  ])("clears %s", (name) => {
    expect(shouldClearExpiredSessionCookie(name)).toBe(true);
  });

  it.each([
    "theme",
    "analytics_session",
    "sb-projectref-auth-token-code-verifier",
    "other-auth-token",
  ])("preserves %s", (name) => {
    expect(shouldClearExpiredSessionCookie(name)).toBe(false);
  });
});
