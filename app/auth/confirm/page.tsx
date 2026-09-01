"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { confirmPasswordRecovery } from "@/lib/auth/password-recovery-confirmation";
import { createClient } from "@/lib/supabase/client";

export default function ConfirmAuthPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    setIsLoading(true);

    try {
      const supabase = createClient();
      const result = await confirmPasswordRecovery(
        supabase.auth,
        new URLSearchParams(window.location.search),
      );

      if (!result.ok) {
        setError(
          result.reason === "invalid"
            ? "Password reset link is invalid. Please request a new link."
            : "Password reset link is invalid or has expired.",
        );
        return;
      }

      window.location.replace("/auth/reset-password");
    } catch {
      setError("Unable to verify the reset link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-6 py-12">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-zinc-950">
            Continue password reset
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Continue to verify this link and choose a new password.
          </p>
        </div>

        {error ? (
          <div className="mb-6 space-y-3">
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
            <Link
              className="flex h-11 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
              href="/forgot-password"
            >
              Request a new reset link
            </Link>
          </div>
        ) : null}

        <form onSubmit={handleConfirm}>
          <button
            className="flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Verifying..." : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
