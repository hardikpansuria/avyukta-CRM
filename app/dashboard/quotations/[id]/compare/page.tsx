"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fieldChangeType,
  type ComparisonField,
} from "@/lib/quotations/comparison/compare-fields";
import {
  diffDescription,
  type DescriptionDiffSegment,
} from "@/lib/quotations/comparison/diff-description";
import { matchRevisionScopes } from "@/lib/quotations/comparison/match-scopes";
import type {
  ChangeType,
  ComparisonResponse,
  ComparisonRevision,
  ScopeComparisonRow,
} from "@/lib/quotations/comparison/types";

import {
  formatCurrency,
  formatPlainDate,
  formatStatus,
  QuotationStatusBadge,
} from "../../quotation-ui";

type Revision = {
  id: string;
  quotation_number?: string | null;
  revision_number?: number | string | null;
  status?: string | null;
};

const changeLabels: Record<ChangeType, string> = {
  unchanged: "Unchanged",
  modified: "Modified",
  added: "Added",
  removed: "Removed",
};

const badgeTones: Record<ChangeType, string> = {
  unchanged:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  modified:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
  added:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
  removed:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
};

function cellTone(changeType: ChangeType, side: "a" | "b") {
  if (changeType === "modified") {
    return "bg-amber-50/80 dark:bg-amber-950/25";
  }
  if (changeType === "added" && side === "b") {
    return "bg-emerald-50/80 dark:bg-emerald-950/25";
  }
  if (changeType === "removed" && side === "a") {
    return "bg-red-50/80 dark:bg-red-950/25";
  }
  return "bg-white dark:bg-zinc-950";
}

function address(document: ComparisonRevision["customerDocument"]) {
  if (!document) return null;
  return [
    document.addressLine1,
    [document.city, document.province].filter(Boolean).join(", "),
    document.postalCode,
  ]
    .filter(Boolean)
    .join(" · ");
}

function discountLabel(type: string | null, value: number, amount: number) {
  if (!type || type === "none" || (!value && !amount)) return "No discount";
  return type === "percentage"
    ? `${value}% (${formatCurrency(amount)})`
    : formatCurrency(amount || value);
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not available";
  }
  return String(value);
}

function updateComparisonUrl(id: string, revisionA: string, revisionB: string) {
  const parameters = new URLSearchParams();
  if (revisionA) parameters.set("revisionA", revisionA);
  if (revisionB) parameters.set("revisionB", revisionB);
  window.history.replaceState(
    null,
    "",
    `/dashboard/quotations/${id}/compare?${parameters.toString()}`,
  );
}

export default function CompareRevisionsPage() {
  const { id } = useParams<{ id: string }>();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [revisionAId, setRevisionAId] = useState("");
  const [revisionBId, setRevisionBId] = useState("");
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRevisions() {
      try {
        const response = await fetch(`/api/org/quotations/${id}/revisions`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { revisions?: Revision[]; error?: string }
          | null;
        if (!response.ok) {
          setError(payload?.error ?? "Unable to load quotation revisions.");
          return;
        }

        const available = payload?.revisions ?? [];
        const parameters = new URLSearchParams(window.location.search);
        const queryA = parameters.get("revisionA");
        const queryB = parameters.get("revisionB");
        const contains = (value: string | null) =>
          Boolean(value && available.some((revision) => revision.id === value));
        const nextA = contains(queryA)
          ? queryA!
          : available.some((revision) => revision.id === id)
            ? id
            : (available[0]?.id ?? "");
        const nextB = contains(queryB) && queryB !== nextA
          ? queryB!
          : (available.find((revision) => revision.id !== nextA)?.id ?? "");

        setRevisions(available);
        setRevisionAId(nextA);
        setRevisionBId(nextB);
        updateComparisonUrl(id, nextA, nextB);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load quotation revisions.");
        }
      }
    }
    void loadRevisions();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (!revisionAId || !revisionBId || revisionAId === revisionBId) {
      return;
    }
    const controller = new AbortController();
    async function loadComparison() {
      setError(null);
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/org/quotations/${id}/compare?revisionA=${encodeURIComponent(revisionAId)}&revisionB=${encodeURIComponent(revisionBId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json().catch(() => null)) as
          | (ComparisonResponse & { error?: string })
          | null;
        if (!response.ok || !payload?.revisionA || !payload.revisionB) {
          setComparison(null);
          setError(payload?.error ?? "Unable to compare revisions.");
          return;
        }
        setComparison(payload);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setComparison(null);
          setError("Unable to compare revisions.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }
    void loadComparison();
    return () => controller.abort();
  }, [id, revisionAId, revisionBId]);

  const scopeRows = useMemo(
    () =>
      comparison
        ? matchRevisionScopes(comparison.revisionA, comparison.revisionB)
        : [],
    [comparison],
  );

  const headerFields = useMemo((): ComparisonField[] => {
    if (!comparison) return [];
    const left = comparison.revisionA;
    const right = comparison.revisionB;
    return [
      {
        label: "Quotation Number",
        revisionA:
          left.customerDocument?.quotationNumber ?? left.quotation.quotationNumber,
        revisionB:
          right.customerDocument?.quotationNumber ?? right.quotation.quotationNumber,
      },
      {
        label: "Revision Number",
        revisionA:
          left.customerDocument?.revisionNumber ?? left.quotation.revisionNumber,
        revisionB:
          right.customerDocument?.revisionNumber ?? right.quotation.revisionNumber,
        kind: "number",
      },
      {
        label: "Customer",
        revisionA:
          left.customerDocument?.customerName ?? left.quotation.customerNameFallback,
        revisionB:
          right.customerDocument?.customerName ?? right.quotation.customerNameFallback,
      },
      {
        label: "Address",
        revisionA: address(left.customerDocument),
        revisionB: address(right.customerDocument),
      },
      {
        label: "Attention",
        revisionA: left.customerDocument?.attentionName,
        revisionB: right.customerDocument?.attentionName,
      },
      {
        label: "Email",
        revisionA: left.customerDocument?.attentionEmail,
        revisionB: right.customerDocument?.attentionEmail,
      },
      {
        label: "Quotation Date",
        revisionA: left.customerDocument?.quotationDate,
        revisionB: right.customerDocument?.quotationDate,
        kind: "date",
      },
      {
        label: "Valid Until",
        revisionA: left.quotation.expiryDate,
        revisionB: right.quotation.expiryDate,
        kind: "date",
      },
      {
        label: "Delivery",
        revisionA: left.customerDocument?.delivery,
        revisionB: right.customerDocument?.delivery,
      },
      {
        label: "Terms",
        revisionA: left.customerDocument?.terms,
        revisionB: right.customerDocument?.terms,
      },
      {
        label: "FOB",
        revisionA: left.customerDocument?.fob,
        revisionB: right.customerDocument?.fob,
      },
      {
        label: "Prepared By",
        revisionA: left.customerDocument?.preparedBy,
        revisionB: right.customerDocument?.preparedBy,
      },
      {
        label: "Status",
        revisionA: formatStatus(left.quotation.status),
        revisionB: formatStatus(right.quotation.status),
      },
    ];
  }, [comparison]);

  const pricingFields = useMemo((): ComparisonField[] => {
    if (!comparison) return [];
    const left = comparison.revisionA.pricing;
    const right = comparison.revisionB.pricing;
    return [
      { label: "Scope Subtotal", revisionA: left.scopeSubtotal, revisionB: right.scopeSubtotal, kind: "number" },
      { label: "Final Discount", revisionA: left.finalDiscount, revisionB: right.finalDiscount, kind: "number" },
      { label: "Final Additional Charges", revisionA: left.finalAdditionalCharges, revisionB: right.finalAdditionalCharges, kind: "number" },
      { label: "Grand Total Before Tax", revisionA: left.grandTotalBeforeTax, revisionB: right.grandTotalBeforeTax, kind: "number" },
      { label: "Tax Name", revisionA: left.taxName, revisionB: right.taxName },
      { label: "Tax Rate", revisionA: left.taxRate, revisionB: right.taxRate, kind: "number" },
      { label: "Tax Amount", revisionA: left.taxAmount, revisionB: right.taxAmount, kind: "number" },
      { label: "Grand Total", revisionA: left.grandTotal, revisionB: right.grandTotal, kind: "number" },
    ];
  }, [comparison]);

  function changeRevision(side: "a" | "b", value: string) {
    if ((side === "a" && value === revisionBId) || (side === "b" && value === revisionAId)) return;
    const nextA = side === "a" ? value : revisionAId;
    const nextB = side === "b" ? value : revisionBId;
    if (side === "a") setRevisionAId(value);
    else setRevisionBId(value);
    updateComparisonUrl(id, nextA, nextB);
  }

  const revisionA = comparison?.revisionA;
  const revisionB = comparison?.revisionB;

  return (
    <div className="mx-auto max-w-7xl pb-16">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            Revision Comparison
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Customer-facing content and pricing across two quotation revisions.
          </p>
        </div>
        <Button nativeButton={false} render={<Link href={`/dashboard/quotations/${id}`} />} variant="outline">
          Back to Quotation
        </Button>
      </header>

      <Card className="mt-6 rounded-lg">
        <CardHeader>
          <CardTitle>Select revisions</CardTitle>
          <CardDescription>Both revisions must belong to this quotation series.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <RevisionSelect label="Revision A" value={revisionAId} disabledId={revisionBId} revisions={revisions} onChange={(value) => changeRevision("a", value)} />
          <RevisionSelect label="Revision B" value={revisionBId} disabledId={revisionAId} revisions={revisions} onChange={(value) => changeRevision("b", value)} />
        </CardContent>
      </Card>

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Loading comparison…
        </div>
      ) : null}

      {!isLoading && revisionA && revisionB ? (
        <div className="mt-6 space-y-6">
          <Card className="rounded-lg">
            <CardContent className="grid items-center gap-4 pt-1 sm:grid-cols-[1fr_auto_1fr]">
              <RevisionSummary label="Revision A" revision={revisionA} />
              <span className="text-center text-sm font-semibold text-zinc-400">VS</span>
              <RevisionSummary label="Revision B" revision={revisionB} />
            </CardContent>
          </Card>

          <ChangeLegend />

          {(!revisionA.hasCustomerDocument || !revisionB.hasCustomerDocument) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {!revisionA.hasCustomerDocument ? <MissingDraft label="Revision A" /> : <div />}
              {!revisionB.hasCustomerDocument ? <MissingDraft label="Revision B" /> : null}
            </div>
          ) : null}

          <ComparisonSection
            title="Customer Quotation Header"
            description="Persisted customer-facing snapshots are used when available."
            fields={headerFields}
            revisionALabel={`Rev ${revisionA.quotation.revisionNumber}`}
            revisionBLabel={`Rev ${revisionB.quotation.revisionNumber}`}
            format={(value, field) => field.kind === "date" ? (value ? formatPlainDate(value as string) : "Not available") : displayValue(value)}
          />

          <section aria-labelledby="scope-comparison-title" className="space-y-4">
            <div>
              <h2 id="scope-comparison-title" className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">Scope of Work</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Matched scopes, quantities, customer pricing, and descriptions.</p>
            </div>
            {scopeRows.length ? scopeRows.map((row, index) => (
              <ScopeComparison key={row.key} row={row} index={index} revisionA={revisionA} revisionB={revisionB} />
            )) : (
              <Card className="rounded-lg"><CardContent className="text-sm text-zinc-500">No scopes are available in either revision.</CardContent></Card>
            )}
          </section>

          <ComparisonSection
            title="Pricing Summary"
            description="Authoritative persisted totals for each selected revision."
            fields={pricingFields}
            revisionALabel={`Rev ${revisionA.quotation.revisionNumber}`}
            revisionBLabel={`Rev ${revisionB.quotation.revisionNumber}`}
            format={(value, field) => field.label === "Tax Name" ? displayValue(value) : field.label === "Tax Rate" ? `${Number(value ?? 0)}%` : formatCurrency(value as number | string | null)}
          />
        </div>
      ) : null}

      {!isLoading && !error && revisions.length > 0 && (!revisionA || !revisionB) ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
          Select two different revisions to compare.
        </div>
      ) : null}
    </div>
  );
}

function RevisionSelect({
  label,
  value,
  disabledId,
  revisions,
  onChange,
}: {
  label: string;
  value: string;
  disabledId: string;
  revisions: Revision[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
      {label}
      <Select value={value} onValueChange={(next) => onChange(String(next))}>
        <SelectTrigger className="mt-2 w-full" aria-label={label}>
          <SelectValue placeholder="Select revision" />
        </SelectTrigger>
        <SelectContent>
          {revisions.map((revision) => (
            <SelectItem disabled={revision.id === disabledId} key={revision.id} value={revision.id}>
              {revision.quotation_number ?? "Quotation"} · Rev {revision.revision_number ?? 0} · {formatStatus(revision.status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function RevisionSummary({ label, revision }: { label: string; revision: ComparisonRevision }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {revision.quotation.quotationNumber ?? "Quotation"} — Rev {revision.quotation.revisionNumber}
      </p>
      <QuotationStatusBadge className="mt-2" status={revision.quotation.status} />
    </div>
  );
}

function ChangeLegend() {
  return (
    <div aria-label="Comparison legend" className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-zinc-500">Legend</span>
      {(["added", "removed", "modified", "unchanged"] as ChangeType[]).map((type) => (
        <Badge className={badgeTones[type]} key={type} variant="outline">{changeLabels[type]}</Badge>
      ))}
    </div>
  );
}

function MissingDraft({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
      <span className="font-semibold">{label}:</span> No customer-facing quotation draft is available. Internal scope and persisted quotation totals are shown where supported.
    </div>
  );
}

function ComparisonSection({
  title,
  description,
  fields,
  revisionALabel,
  revisionBLabel,
  format,
}: {
  title: string;
  description: string;
  fields: ComparisonField[];
  revisionALabel: string;
  revisionBLabel: string;
  format: (value: unknown, field: ComparisonField) => string;
}) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ComparisonTable fields={fields} revisionALabel={revisionALabel} revisionBLabel={revisionBLabel} format={format} />
      </CardContent>
    </Card>
  );
}

function ComparisonTable({
  fields,
  revisionALabel,
  revisionBLabel,
  format,
}: {
  fields: ComparisonField[];
  revisionALabel: string;
  revisionBLabel: string;
  format: (value: unknown, field: ComparisonField) => string;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table className="min-w-[760px] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900">
            <TableRow>
              <TableHead className="w-[24%] whitespace-normal">Field</TableHead>
              <TableHead className="w-[38%] whitespace-normal">Revision A · {revisionALabel}</TableHead>
              <TableHead className="w-[38%] whitespace-normal">Revision B · {revisionBLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((field) => {
              const changeType = fieldChangeType(field);
              return (
                <TableRow key={field.label}>
                  <TableCell className="whitespace-normal align-top font-medium">
                    <div className="flex flex-wrap items-center gap-2">
                      {field.label}
                      {changeType !== "unchanged" ? <Badge className={badgeTones[changeType]} variant="outline">{changeLabels[changeType]}</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className={`${cellTone(changeType, "a")} whitespace-pre-wrap break-words align-top`}>{format(field.revisionA, field)}</TableCell>
                  <TableCell className={`${cellTone(changeType, "b")} whitespace-pre-wrap break-words align-top`}>{format(field.revisionB, field)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 md:hidden">
        {fields.map((field) => {
          const changeType = fieldChangeType(field);
          return (
            <article className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800" key={field.label}>
              <div className="flex items-center justify-between gap-2 bg-zinc-50 px-3 py-2 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">{field.label}</h3>
                {changeType !== "unchanged" ? <Badge className={badgeTones[changeType]} variant="outline">{changeLabels[changeType]}</Badge> : null}
              </div>
              <div className={`${cellTone(changeType, "a")} p-3`}><p className="text-xs font-semibold uppercase text-zinc-500">Revision A · {revisionALabel}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{format(field.revisionA, field)}</p></div>
              <Separator />
              <div className={`${cellTone(changeType, "b")} p-3`}><p className="text-xs font-semibold uppercase text-zinc-500">Revision B · {revisionBLabel}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{format(field.revisionB, field)}</p></div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ScopeComparison({
  row,
  index,
  revisionA,
  revisionB,
}: {
  row: ScopeComparisonRow;
  index: number;
  revisionA: ComparisonRevision;
  revisionB: ComparisonRevision;
}) {
  const left = row.revisionA;
  const right = row.revisionB;
  const itemA = row.customerItemA;
  const itemB = row.customerItemB;
  const baseFields: ComparisonField[] = [
    { label: "Included", revisionA: left ? "Included" : "Not included", revisionB: right ? "Included" : "Removed" },
    { label: "Scope Title", revisionA: left?.title, revisionB: right?.title },
    { label: "Internal Scope Quantity", revisionA: left?.quantity, revisionB: right?.quantity, kind: "number" },
    { label: "Customer-facing Quantity", revisionA: itemA?.quantity ?? left?.quantity, revisionB: itemB?.quantity ?? right?.quantity, kind: "number" },
    { label: "Calculated Price Each", revisionA: itemA?.priceEach ?? left?.calculatedPriceEach, revisionB: itemB?.priceEach ?? right?.calculatedPriceEach, kind: "number" },
    { label: "Price Ext", revisionA: itemA?.priceExt ?? left?.scopeTotal, revisionB: itemB?.priceExt ?? right?.scopeTotal, kind: "number" },
    { label: "Scope Total", revisionA: left?.scopeTotal, revisionB: right?.scopeTotal, kind: "number" },
    { label: "Scope Discount", revisionA: left ? discountLabel(left.discountType, left.discountValue, left.discountAmount) : null, revisionB: right ? discountLabel(right.discountType, right.discountValue, right.discountAmount) : null },
  ];
  const fields: ComparisonField[] = baseFields.map((field) =>
    row.changeType === "added" || row.changeType === "removed"
      ? { ...field, changeType: row.changeType }
      : field,
  );
  const descriptionA = itemA?.descriptionText ?? left?.description ?? null;
  const descriptionB = itemB?.descriptionText ?? right?.description ?? null;
  const descriptionDiff = useMemo(
    () => diffDescription(descriptionA, descriptionB),
    [descriptionA, descriptionB],
  );
  const title = right?.title ?? left?.title ?? `Scope of Work ${index + 1}`;

  return (
    <Card className="rounded-lg">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <Badge className={badgeTones[row.changeType]} variant="outline">{changeLabels[row.changeType]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ComparisonTable
          fields={fields}
          revisionALabel={`Rev ${revisionA.quotation.revisionNumber}`}
          revisionBLabel={`Rev ${revisionB.quotation.revisionNumber}`}
          format={(value, field) => ["Calculated Price Each", "Price Ext", "Scope Total"].includes(field.label) ? (value === null || value === undefined ? "Not available" : formatCurrency(value as number)) : displayValue(value)}
        />
        <div>
          <h3 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">Customer-facing Description</h3>
          <DescriptionComparison
            revisionA={descriptionDiff.revisionA}
            revisionB={descriptionDiff.revisionB}
            revisionALabel={`Rev ${revisionA.quotation.revisionNumber}`}
            revisionBLabel={`Rev ${revisionB.quotation.revisionNumber}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function DescriptionComparison({
  revisionA,
  revisionB,
  revisionALabel,
  revisionBLabel,
}: {
  revisionA: DescriptionDiffSegment[];
  revisionB: DescriptionDiffSegment[];
  revisionALabel: string;
  revisionBLabel: string;
}) {
  return (
    <div className="grid overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 md:grid-cols-2">
      <DescriptionPane label={`Revision A · ${revisionALabel}`} segments={revisionA} />
      <DescriptionPane className="border-t border-zinc-200 dark:border-zinc-800 md:border-l md:border-t-0" label={`Revision B · ${revisionBLabel}`} segments={revisionB} />
    </div>
  );
}

function DescriptionPane({ label, segments, className = "" }: { label: string; segments: DescriptionDiffSegment[]; className?: string }) {
  return (
    <div className={className}>
      <p className="bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase text-zinc-500 dark:bg-zinc-900">{label}</p>
      <p className="min-h-24 whitespace-pre-wrap break-words p-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
        {segments.length ? segments.map((segment, index) => (
          <span
            className={segment.type === "added" ? "rounded-sm bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100" : segment.type === "removed" ? "rounded-sm bg-red-100 text-red-900 line-through decoration-red-500/60 dark:bg-red-900/50 dark:text-red-100" : undefined}
            key={`${segment.type}-${index}`}
          >
            {segment.text}
          </span>
        )) : <span className="text-zinc-400">No description</span>}
      </p>
    </div>
  );
}
