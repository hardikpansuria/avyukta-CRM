"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Revision = { id: string; revision_number?: number | string; status?: string };
type Change = { section: string; label: string; status: "added" | "removed" | "modified" | "unchanged"; revisionA: unknown; revisionB: unknown };

const tones = { added: "border-emerald-200 bg-emerald-50 text-emerald-800", removed: "border-red-200 bg-red-50 text-red-800", modified: "border-amber-200 bg-amber-50 text-amber-800", unchanged: "border-zinc-200 bg-zinc-50 text-zinc-600" };

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key.replaceAll("_", " ")}: ${String(item ?? "—")}`).join(" · ");
  return String(value);
}

export default function CompareRevisionsPage() {
  const { id } = useParams<{ id: string }>();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [changes, setChanges] = useState<Change[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void fetch(`/api/org/quotations/${id}/revisions`, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json(); if (!response.ok) { setError(payload.error); return; }
    setRevisions(payload.revisions ?? []); setA(id); setB((payload.revisions ?? []).find((row: Revision) => row.id !== id)?.id ?? "");
  }); }, [id]);
  useEffect(() => { if (!a || !b || a === b) return; void fetch(`/api/org/quotations/${id}/compare?revisionA=${encodeURIComponent(a)}&revisionB=${encodeURIComponent(b)}`, { cache: "no-store" }).then(async (response) => {
    const payload = await response.json(); if (!response.ok) { setError(payload.error); return; } setError(null); setChanges(payload.changes ?? []);
  }); }, [a, b, id]);
  const visibleChanges = a && b && a !== b ? changes : [];
  const sections = Array.from(new Set(visibleChanges.map((change) => change.section)));
  return <div className="mx-auto max-w-7xl pb-16">
    <div className="flex items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold">Compare Revisions</h1><p className="mt-1 text-sm text-zinc-500">Business changes across any two revisions in this quotation series.</p></div><Button nativeButton={false} render={<Link href={`/dashboard/quotations/${id}`} />} variant="outline">Back</Button></div>
    <div className="mt-6 grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2 dark:bg-zinc-950">
      <RevisionSelect label="Revision A" value={a} revisions={revisions} onChange={setA} />
      <RevisionSelect label="Revision B" value={b} revisions={revisions} onChange={setB} />
    </div>
    {error ? <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-6 space-y-6">{sections.map((section) => <section className="rounded-lg border bg-white p-5 dark:bg-zinc-950" key={section}><h2 className="font-semibold">{section}</h2><div className="mt-4 space-y-3">{visibleChanges.filter((change) => change.section === section).map((change, index) => <div className="grid gap-3 rounded-md border p-3 lg:grid-cols-[170px_1fr_1fr]" key={`${change.label}-${index}`}><div><Badge className={tones[change.status]} variant="outline">{change.status.toUpperCase()}</Badge><p className="mt-2 text-sm font-medium capitalize">{change.label}</p></div><div className="text-sm text-zinc-600"><span className="mb-1 block text-xs font-medium uppercase">Revision A</span>{display(change.revisionA)}</div><div className="text-sm text-zinc-600"><span className="mb-1 block text-xs font-medium uppercase">Revision B</span>{display(change.revisionB)}</div></div>)}</div></section>)}</div>
  </div>;
}

function RevisionSelect({ label, value, revisions, onChange }: { label: string; value: string; revisions: Revision[]; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<Select value={value} onValueChange={(next) => onChange(String(next))}><SelectTrigger className="mt-2 w-full"><SelectValue /></SelectTrigger><SelectContent>{revisions.map((revision) => <SelectItem key={revision.id} value={revision.id}>Rev {revision.revision_number ?? 0} · {revision.status ?? "draft"}</SelectItem>)}</SelectContent></Select></label>;
}
