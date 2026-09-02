import { createHash } from "node:crypto";

import type { LegalActionType } from "./documents";

export type AcceptanceReceiptDocument = {
  key: string;
  title: string;
  version: string;
  contentHash: string;
  actionType: LegalActionType;
  acceptedAt: string;
};

export type AcceptanceReceiptInput = {
  userId: string;
  organizationId: string;
  recipientEmail: string;
  recipientName: string | null;
  organizationName: string;
  organizationCode: string;
  acceptanceSource: "first_login_gate" | "version_update";
  documents: AcceptanceReceiptDocument[];
  privacyContactEmail: string;
};

export type AcceptanceReceiptResult =
  | { status: "sent"; messageId: string | null }
  | { status: "skipped"; reason: "not_configured" }
  | { status: "failed"; reason: "provider_error" };

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function greetingName(name: string | null, email: string) {
  const normalizedName = name?.trim();

  if (normalizedName) return normalizedName;

  return email.split("@")[0] || "there";
}

function readableAction(action: LegalActionType) {
  return action === "agreed" ? "Agreed" : "Acknowledged";
}

export function buildAcceptanceReceiptEmail(
  input: AcceptanceReceiptInput,
  siteUrl: string,
) {
  const isWelcome = input.acceptanceSource === "first_login_gate";
  const subject = isWelcome
    ? "Welcome to Avyukta CRM — legal acceptance confirmed"
    : "Your Avyukta CRM legal acceptance receipt";
  const safeName = escapeHtml(
    greetingName(input.recipientName, input.recipientEmail),
  );
  const safeOrganization = escapeHtml(input.organizationName);
  const safeOrganizationCode = escapeHtml(input.organizationCode);
  const safeEmail = escapeHtml(input.recipientEmail);
  const safePrivacyEmail = escapeHtml(input.privacyContactEmail);
  const loginUrl = new URL("/login", siteUrl).toString();
  const documentItems = input.documents
    .map(
      (document) => `
        <li style="margin:0 0 12px;">
          <strong>${escapeHtml(document.title)}</strong><br>
          Version ${escapeHtml(document.version)} · ${readableAction(document.actionType)}<br>
          <span style="color:#52525b;">Recorded ${escapeHtml(
            new Date(document.acceptedAt).toLocaleString("en-CA", {
              dateStyle: "long",
              timeStyle: "short",
              timeZone: "UTC",
            }),
          )} UTC</span>
        </li>`,
    )
    .join("");

  return {
    subject,
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b;">
    <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
      <div style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;">
        <p style="margin:0 0 20px;font-size:18px;">Hi ${safeName},</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">
          ${isWelcome ? "Welcome to Avyukta CRM" : "Legal acceptance confirmed"}
        </h1>
        <p style="margin:0 0 20px;line-height:1.6;">
          ${isWelcome ? "You have completed the required legal review and can now use the CRM portal." : "You have completed the required review of the updated CRM legal documents."}
          This email is your receipt.
        </p>

        <div style="margin:0 0 24px;padding:18px;background:#f4f4f5;border-radius:8px;line-height:1.7;">
          <strong>Organization:</strong> ${safeOrganization}<br>
          <strong>Org code:</strong> ${safeOrganizationCode}<br>
          <strong>Username:</strong> ${safeEmail}
        </div>

        <p style="margin:0 0 12px;font-weight:bold;">Recorded documents</p>
        <ul style="margin:0 0 24px;padding-left:22px;line-height:1.5;">
          ${documentItems}
        </ul>

        <a href="${escapeHtml(loginUrl)}" style="display:inline-block;margin:0 0 24px;padding:12px 18px;border-radius:7px;background:#18181b;color:#ffffff;text-decoration:none;font-weight:bold;">
          Open Avyukta CRM
        </a>

        <p style="margin:0 0 10px;line-height:1.6;">
          Each time you sign in, use org code <strong>${safeOrganizationCode}</strong>, your email address as the username, and your password.
        </p>
        <p style="margin:0;color:#52525b;font-size:13px;line-height:1.6;">
          This is a transactional service email, not a marketing message. For privacy questions, contact
          <a href="mailto:${safePrivacyEmail}" style="color:#18181b;">${safePrivacyEmail}</a>.
          Never send your password by email.
        </p>
      </div>
    </div>
  </body>
</html>`,
  };
}

export function acceptanceReceiptIdempotencyKey(
  input: AcceptanceReceiptInput,
) {
  const documentFingerprint = input.documents
    .map(
      (document) =>
        `${document.key}:${document.version}:${document.contentHash}:${document.actionType}`,
    )
    .sort()
    .join("|");
  const digest = createHash("sha256")
    .update(
      `${input.userId}|${input.organizationId}|${input.acceptanceSource}|${documentFingerprint}`,
    )
    .digest("hex");

  return `legal-acceptance-${digest}`;
}

export async function sendAcceptanceReceiptEmail(
  input: AcceptanceReceiptInput,
): Promise<AcceptanceReceiptResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.LEGAL_ACCEPTANCE_EMAIL_FROM?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!apiKey || !from || !siteUrl) {
    console.warn(
      "Legal acceptance receipt email skipped because email configuration is incomplete.",
    );
    return { status: "skipped", reason: "not_configured" };
  }

  const message = buildAcceptanceReceiptEmail(input, siteUrl);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": acceptanceReceiptIdempotencyKey(input),
      },
      body: JSON.stringify({
        from,
        to: [input.recipientEmail],
        subject: message.subject,
        html: message.html,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(
        `Legal acceptance receipt provider returned HTTP ${response.status}.`,
      );
      return { status: "failed", reason: "provider_error" };
    }

    const payload = (await response.json().catch(() => null)) as {
      id?: unknown;
    } | null;

    return {
      status: "sent",
      messageId: typeof payload?.id === "string" ? payload.id : null,
    };
  } catch (error) {
    console.error("Unable to send legal acceptance receipt email.", error);
    return { status: "failed", reason: "provider_error" };
  }
}
