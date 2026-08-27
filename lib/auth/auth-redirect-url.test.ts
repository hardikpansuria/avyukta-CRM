import { describe, expect, it } from "vitest";

import { buildAuthRedirectUrl } from "./auth-redirect-url";

describe("buildAuthRedirectUrl", () => {
  it("builds the invitation password path from a site origin", () => {
    expect(
      buildAuthRedirectUrl(
        "https://avyukta-crm.vercel.app",
        "/auth/reset-password",
      ),
    ).toBe("https://avyukta-crm.vercel.app/auth/reset-password");
  });

  it("removes duplicate slashes from a trailing site slash", () => {
    expect(
      buildAuthRedirectUrl(
        "https://avyukta-crm.vercel.app/",
        "/auth/reset-password",
      ),
    ).toBe("https://avyukta-crm.vercel.app/auth/reset-password");
  });

  it("rejects non-HTTP site URLs", () => {
    expect(() =>
      buildAuthRedirectUrl("javascript:alert(1)", "/auth/reset-password"),
    ).toThrow("Site URL must use HTTP or HTTPS.");
  });
});
