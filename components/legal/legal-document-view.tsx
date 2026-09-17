import type { LegalDocument } from "@/lib/legal/documents";

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <article className="mx-auto max-w-4xl">
      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Avyukta CRM legal
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          {document.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
          {document.description}
        </p>
        <dl className="mt-6 grid gap-3 text-sm text-zinc-600 sm:grid-cols-3 dark:text-zinc-400">
          <div>
            <dt className="font-medium text-zinc-950 dark:text-zinc-100">Version</dt>
            <dd>{document.version}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-950 dark:text-zinc-100">
              Effective date
            </dt>
            <dd>{document.effectiveDate}</dd>
          </div>
          <div>
            <dt className="font-medium text-zinc-950 dark:text-zinc-100">
              Last updated
            </dt>
            <dd>{document.lastUpdated}</dd>
          </div>
        </dl>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          aria-label={`${document.title} table of contents`}
          className="legal-no-print lg:sticky lg:top-6 lg:self-start"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            On this page
          </p>
          <ol className="mt-3 space-y-2 text-sm">
            {document.sections.map((section) => (
              <li key={section.id}>
                <a
                  className="text-zinc-600 underline-offset-4 hover:text-zinc-950 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:text-zinc-400 dark:hover:text-zinc-50"
                  href={`#${section.id}`}
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-10">
          {document.sections.map((section) => (
            <section className="scroll-mt-6" id={section.id} key={section.id}>
              <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300"
                  key={paragraph}
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-zinc-700 marker:text-zinc-400 dark:text-zinc-300">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
