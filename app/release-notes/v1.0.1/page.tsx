import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Clock3Icon,
  SparklesIcon,
} from "lucide-react";

import { currentRelease } from "@/lib/releases/current-release";

export const metadata: Metadata = {
  title: `Version ${currentRelease.version} | Avyukta CRM`,
  description: `What changed in Avyukta CRM version ${currentRelease.version}.`,
};

export default function ReleaseNotesPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-10 text-zinc-950 sm:px-8 sm:py-16 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto max-w-3xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          href="/login"
        >
          <ArrowLeftIcon className="size-4" />
          Back to sign in
        </Link>

        <header className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <SparklesIcon className="size-5" />
          </div>
          <p className="mt-6 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Published version v{currentRelease.version}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            What changed in v{currentRelease.version}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-400">
            This release makes quotation and purchase-order work clearer, safer,
            and easier to follow.
          </p>
          <p className="mt-5 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <Clock3Icon className="size-4" />
            Last published:
            <time dateTime={currentRelease.publishedAt}>
              {currentRelease.publishedLabel}
            </time>
          </p>
        </header>

        <section
          aria-labelledby="release-changes-heading"
          className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <h2 className="text-xl font-semibold" id="release-changes-heading">
            Included in this release
          </h2>
          <ul className="mt-6 space-y-6">
            {currentRelease.changes.map((change) => (
              <li className="flex items-start gap-3" key={change.title}>
                <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="font-semibold">{change.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {change.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
