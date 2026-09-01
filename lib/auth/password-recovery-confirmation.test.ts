import { describe, expect, it, vi } from "vitest";

import { confirmPasswordRecovery } from "./password-recovery-confirmation";

function authClient() {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
  };
}

describe("confirmPasswordRecovery", () => {
  it("exchanges the PKCE code produced by the default Supabase recovery link", async () => {
    const auth = authClient();

    await expect(
      confirmPasswordRecovery(auth, new URLSearchParams("code=auth-code")),
    ).resolves.toEqual({ ok: true });

    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("auth-code");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("verifies the token hash produced by the recommended recovery template", async () => {
    const auth = authClient();

    await expect(
      confirmPasswordRecovery(
        auth,
        new URLSearchParams("token_hash=token-hash&type=recovery"),
      ),
    ).resolves.toEqual({ ok: true });

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "token-hash",
      type: "recovery",
    });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("rejects malformed links without calling Supabase Auth", async () => {
    const auth = authClient();

    await expect(
      confirmPasswordRecovery(
        auth,
        new URLSearchParams("token_hash=token-hash&type=invite"),
      ),
    ).resolves.toEqual({ ok: false, reason: "invalid" });

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("reports expired or already-consumed PKCE codes", async () => {
    const auth = authClient();
    auth.exchangeCodeForSession.mockResolvedValue({
      error: new Error("invalid flow state"),
    });

    await expect(
      confirmPasswordRecovery(auth, new URLSearchParams("code=used-code")),
    ).resolves.toEqual({ ok: false, reason: "expired" });
  });

  it("honors errors returned in the callback URL", async () => {
    const auth = authClient();

    await expect(
      confirmPasswordRecovery(
        auth,
        new URLSearchParams("error_code=otp_expired&code=unused"),
      ),
    ).resolves.toEqual({ ok: false, reason: "expired" });

    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
