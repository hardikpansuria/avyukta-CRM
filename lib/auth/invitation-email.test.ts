import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildInvitationEmailData } from "./invitation-email";

describe("invitation email", () => {
  it("provides personalized organization login details to Supabase Auth", () => {
    expect(
      buildInvitationEmailData({
        fullName: "  Hardik Pansuria  ",
        organizationName: "  ProTech  ",
        organizationCode: "  4455  ",
      }),
    ).toEqual({
      full_name: "Hardik Pansuria",
      organization_name: "ProTech",
      organization_code: "4455",
    });
  });

  it("keeps the required personalization and sign-in guidance in the template", () => {
    const template = readFileSync(
      new URL("../../supabase/templates/invite.html", import.meta.url),
      "utf8",
    );

    expect(template).toContain("{{ .Data.full_name }}");
    expect(template).toContain("{{ .Data.organization_name }}");
    expect(template).toContain("{{ .Data.organization_code }}");
    expect(template).toContain("{{ .Email }}");
    expect(template).toContain("{{ .ConfirmationURL }}");
    expect(template).toContain("every time you sign in");
  });
});
