type PasswordRecoveryAuth = {
  exchangeCodeForSession: (code: string) => PromiseLike<{ error: unknown }>;
  verifyOtp: (input: {
    token_hash: string;
    type: "recovery";
  }) => PromiseLike<{ error: unknown }>;
};

export type PasswordRecoveryConfirmationResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" };

function value(params: URLSearchParams, key: string) {
  return params.get(key)?.trim() ?? "";
}

export async function confirmPasswordRecovery(
  auth: PasswordRecoveryAuth,
  params: URLSearchParams,
): Promise<PasswordRecoveryConfirmationResult> {
  if (value(params, "error") || value(params, "error_code")) {
    return { ok: false, reason: "expired" };
  }

  const code = value(params, "code");
  if (code) {
    const { error } = await auth.exchangeCodeForSession(code);
    return error
      ? { ok: false, reason: "expired" }
      : { ok: true };
  }

  const tokenHash = value(params, "token_hash");
  const type = value(params, "type");
  if (!tokenHash || type !== "recovery") {
    return { ok: false, reason: "invalid" };
  }

  const { error } = await auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  return error
    ? { ok: false, reason: "expired" }
    : { ok: true };
}
