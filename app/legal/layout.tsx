import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { getLegalSiteConfiguration } from "@/lib/legal/config";

const legalLinks = [
  ["Privacy", "/legal/privacy"],
  ["User Terms", "/legal/terms"],
  ["Acceptable Use", "/legal/acceptable-use"],
  ["Cookies", "/legal/cookies"],
  ["Subprocessors", "/legal/subprocessors"],
  ["Open Source", "/legal/open-source"],
  ["Security", "/security"],
] as const;

export default function LegalLayout({ children }: { children: ReactNode }) {
  const config = getLegalSiteConfiguration();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      {!config.ready ? (
        <div className="legal-no-print border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Draft legal configuration — production publication is blocked until
          the legal facts and approval are complete.
        </div>
      ) : null}
      <header className="legal-no-print border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <Link
            className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            href="/login"
          >
            <Image
              alt=""
              className="size-10 object-contain"
              height={40}
              src="/superlight-crm-logo.png"
              width={40}
            />
            <span>
              <span className="block text-sm font-semibold">Avyukta CRM</span>
              <span className="block text-xs text-zinc-500">
                Legal and trust centre
              </span>
            </span>
          </Link>
          <nav aria-label="Legal pages">
            <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {legalLinks.map(([label, href]) => (
                <li key={href}>
                  <Link
                    className="underline-offset-4 hover:text-zinc-950 hover:underline dark:hover:text-zinc-50"
                    href={href}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8">{children}</main>

      <footer className="legal-no-print border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-zinc-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p>© 2026 Avyukta Technologies Inc.</p>
          <p>
            Privacy contact: {config.privacyContactEmail}
          </p>
        </div>
      </footer>
    </div>
  );
}
