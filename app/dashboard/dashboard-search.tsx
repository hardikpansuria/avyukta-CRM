"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

type Result = { id: string; kind: string; title: string; subtitle: string; href: string };

export function DashboardSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) {
      return () => controller.abort();
    }
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/org/dashboard-search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json() as { results?: Result[] };
        if (response.ok) setResults(payload.results ?? []);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="relative w-full" ref={root}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label="Global search"
        className="h-11 bg-background pl-10 shadow-sm"
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          if (value.trim().length < 2) {
            setResults([]);
            setLoading(false);
          } else {
            setLoading(true);
          }
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search Customer, Quotation, PO, Job, Invoice..."
        value={query}
      />
      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto rounded-lg border bg-popover p-2 text-popover-foreground shadow-xl">
          {loading ? <p className="px-3 py-5 text-center text-sm text-muted-foreground">Searching…</p> : null}
          {!loading && results.length === 0 ? <p className="px-3 py-5 text-center text-sm text-muted-foreground">No matching CRM records.</p> : null}
          {!loading ? results.map((result) => (
            <Link className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 hover:bg-accent" href={result.href} key={`${result.kind}-${result.id}`} onClick={() => setOpen(false)}>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title}</span><span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span></span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">{result.kind}</span>
            </Link>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}
