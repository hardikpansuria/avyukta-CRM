"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { RequiredMark } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepareResetSession() {
      const supabase = createClient();
      const queryParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const authErrorCode =
        queryParams.get("error_code") ?? hashParams.get("error_code");
      const authErrorDescription =
        queryParams.get("error_description") ??
        hashParams.get("error_description");

      if (authErrorCode || authErrorDescription) {
        if (isMounted) {
          setError(
            authErrorDescription ??
              "Password reset link is invalid or has expired.",
          );
          setIsPreparing(false);
        }
        return;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          if (isMounted) {
            setError("Password reset link is invalid or expired.");
            setIsPreparing(false);
          }
          return;
        }

        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
      } else {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            setError(
              "Password reset session is missing. Please request a new reset link.",
            );
            setIsPreparing(false);
          }
          return;
        }
      }

      if (isMounted) {
        setIsSessionReady(true);
        setIsPreparing(false);
      }
    }

    void prepareResetSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setIsComplete(true);
    } catch {
      setError("Unable to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-950">
            Set new password
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Choose a new password for your account.
          </p>
        </div>

        {isComplete ? (
          <div className="space-y-6">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Your password has been updated.
            </div>
            <Link
              className="flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              href="/login"
            >
              Go to sign in
            </Link>
          </div>
        ) : (
          <>
            {error ? (
              <div className="mb-6 space-y-3">
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
                {!isSessionReady ? (
                  <Link
                    className="flex h-11 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                    href="/forgot-password"
                  >
                    Request a new reset link
                  </Link>
                ) : null}
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-sm font-medium text-zinc-800">
                  New password <RequiredMark />
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-800">
                  Confirm password <RequiredMark />
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10"
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </label>

              <button
                className="flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                type="submit"
                disabled={isLoading || isPreparing || !isSessionReady}
              >
                {isPreparing
                  ? "Preparing..."
                  : isLoading
                    ? "Updating..."
                    : "Update password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
