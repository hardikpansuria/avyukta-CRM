"use client";

import Link from "next/link";
import { useState } from "react";
import { ShieldCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/ui/loading-state";

type AcceptanceDocument = {
  key: string;
  title: string;
  path: string;
  version: string;
  effectiveDate: string;
};

export function AcceptanceForm({
  documents,
  returnPath,
  configurationReady,
}: {
  documents: AcceptanceDocument[];
  returnPath: string;
  configurationReady: boolean;
}) {
  const [checked, setChecked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!checked || isSaving || !configurationReady) return;

    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/legal/acceptance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to record your agreement.");
        return;
      }

      window.location.replace(returnPath);
    } catch {
      setError("Unable to record your agreement. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-2xl" aria-labelledby="acceptance-title">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <ShieldCheckIcon className="size-5" />
        </div>
        <h1
          className="mt-5 text-2xl font-semibold text-zinc-950 dark:text-zinc-50"
          id="acceptance-title"
        >
          Review before continuing
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Your organization requires the current legal documents to be reviewed
          before you access protected CRM records.
        </p>

        <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {documents.map((document) => (
            <li
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              key={document.key}
            >
              <div>
                <Link
                  className="font-medium text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-50"
                  href={document.path}
                  target="_blank"
                >
                  {document.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </Link>
                <p className="mt-1 text-xs text-zinc-500">
                  Version {document.version} · Effective {document.effectiveDate}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {!configurationReady ? (
          <Alert className="mt-6 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
            <AlertTitle>Legal configuration is not approved</AlertTitle>
            <AlertDescription>
              Agreement is disabled until the Privacy Officer, retention facts,
              service region and document approval are configured.
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert className="mt-6" variant="destructive">
            <AlertTitle>Agreement was not recorded</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-4 text-sm leading-6 dark:border-zinc-800">
          <Checkbox
            aria-describedby="legal-agreement-detail"
            checked={checked}
            disabled={!configurationReady || isSaving}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span id="legal-agreement-detail">
            I agree to the Authorized User Terms and Acceptable Use Policy, and
            I acknowledge that I have read the CRM Privacy Notice.
          </span>
        </label>

        <Button
          className="mt-6 h-11 w-full rounded-md"
          disabled={!checked || !configurationReady || isSaving}
          onClick={() => void submit()}
          type="button"
        >
          {isSaving ? (
            <>
              <LoadingSpinner />
              Recording agreement...
            </>
          ) : (
            "Agree and continue"
          )}
        </Button>
        <p className="mt-4 text-center text-xs text-zinc-500">
          This is required service access acknowledgment, not marketing consent.
        </p>
      </div>
    </section>
  );
}
