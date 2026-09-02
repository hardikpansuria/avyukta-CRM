import { afterEach, describe, expect, it, vi } from "vitest";

import {
  acceptanceReceiptIdempotencyKey,
  buildAcceptanceReceiptEmail,
  sendAcceptanceReceiptEmail,
  type AcceptanceReceiptInput,
} from "./acceptance-receipt-email";

const input: AcceptanceReceiptInput = {
  userId: "user-1",
  organizationId: "org-1",
  recipientEmail: "hardik@example.com",
  recipientName: "Hardik <Admin>",
  organizationName: "ProTech & Co.",
  organizationCode: "4455",
  acceptanceSource: "first_login_gate",
  privacyContactEmail: "privacy@example.com",
  documents: [
    {
      key: "authorized_user_terms",
      title: "Authorized User Terms",
      version: "1.0",
      contentHash: "a".repeat(64),
      actionType: "agreed",
      acceptedAt: "2026-09-02T10:00:00.000Z",
    },
    {
      key: "crm_privacy_notice",
      title: "CRM Privacy Notice",
      version: "1.0",
      contentHash: "b".repeat(64),
      actionType: "acknowledged",
      acceptedAt: "2026-09-02T10:00:00.000Z",
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("legal acceptance receipt email", () => {
  it("includes onboarding details and escapes user-controlled HTML", () => {
    const message = buildAcceptanceReceiptEmail(
      input,
      "https://crm.example.com",
    );

    expect(message.subject).toContain("Welcome");
    expect(message.html).toContain("Hi Hardik &lt;Admin&gt;");
    expect(message.html).toContain("ProTech &amp; Co.");
    expect(message.html).toContain("Org code:</strong> 4455");
    expect(message.html).toContain("hardik@example.com");
    expect(message.html).toContain("https://crm.example.com/login");
    expect(message.html).not.toContain("Hardik <Admin>");
  });

  it("uses the same idempotency key regardless of document order", () => {
    expect(acceptanceReceiptIdempotencyKey(input)).toBe(
      acceptanceReceiptIdempotencyKey({
        ...input,
        documents: [...input.documents].reverse(),
      }),
    );
  });

  it("skips delivery safely when server email settings are absent", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("LEGAL_ACCEPTANCE_EMAIL_FROM", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(sendAcceptanceReceiptEmail(input)).resolves.toEqual({
      status: "skipped",
      reason: "not_configured",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends through Resend with an idempotency key when configured", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv(
      "LEGAL_ACCEPTANCE_EMAIL_FROM",
      "Avyukta CRM <no-reply@auth.avyukta.ca>",
    );
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://crm.example.com");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(sendAcceptanceReceiptEmail(input)).resolves.toEqual({
      status: "sent",
      messageId: "email-1",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": acceptanceReceiptIdempotencyKey(input),
        }),
      }),
    );
  });
});
