"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Profile = {
  full_name?: string | null;
  email?: string | null;
};

type Customer = {
  company_name?: string | null;
  customer_code?: string | null;
};

type Quotation = {
  id: string;
  quotation_number?: string | null;
  quote_date?: string | null;
  expiry_date?: string | null;
  project_name?: string | null;
  project_location?: string | null;
  customer_rfq_number?: string | null;
  revision_number?: number | string | null;
  status?: string | null;
  grand_total?: number | string | null;
  material_total?: number | string | null;
  material_profit_total?: number | string | null;
  labour_total?: number | string | null;
  scope_additional_charges_total?: number | string | null;
  scopes_subtotal?: number | string | null;
  scopes_discount_total?: number | string | null;
  final_discount_amount?: number | string | null;
  final_additional_charges_total?: number | string | null;
  grand_total_before_tax?: number | string | null;
  tax_name?: string | null;
  tax_rate?: number | string | null;
  tax_amount?: number | string | null;
  grand_total_after_tax?: number | string | null;
  customer?: Customer | null;
  prepared_by_profile?: Profile | null;
  sales_rep_profile?: Profile | null;
};

type QuotationContact = {
  id?: string;
  contact_name_snapshot?: string | null;
  email_snapshot?: string | null;
  phone_snapshot?: string | null;
};

type QuotationDetail = {
  quotation: Quotation;
  contacts: QuotationContact[];
  scopes: Scope[];
  final_adjustments: FinalAdjustment[];
  note_sections: NoteSection[];
  status_history: StatusHistory[];
  revisions: Revision[];
  tax_warning?: string | null;
};

type FinalAdjustment = {
  id: string;
  description?: string | null;
  calculation_type?: string | null;
  value?: number | string | null;
  calculated_amount?: number | string | null;
};

type NoteSection = {
  id: string;
  section_type?: string | null;
  title?: string | null;
  body_text?: string | null;
  visible_to_customer?: boolean | null;
};

type StatusHistory = {
  id: string;
  old_status?: string | null;
  new_status?: string | null;
  change_note?: string | null;
  created_at?: string | null;
};

type Revision = {
  id: string;
  revision_number?: number | string | null;
  quotation_number?: string | null;
  created_at?: string | null;
};

const statuses = [
  ["draft", "Draft"],
  ["pending_approval", "Pending Approval"],
  ["sent", "Sent"],
  ["accepted", "Accepted"],
  ["rejected", "Rejected"],
  ["expired", "Expired"],
  ["converted_to_work_order", "Converted to Work Order"],
];

type MaterialItem = {
  id: string;
  material_description?: string | null;
  material_category?: string | null;
  supplier_name?: string | null;
  supplier_quote_reference?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unit_cost?: number | string | null;
  material_cost?: number | string | null;
  profit_type?: string | null;
  profit_value?: number | string | null;
  profit_amount?: number | string | null;
  line_total?: number | string | null;
  supplier_quote_document?: {
    id: string;
    file_name: string;
    signed_url?: string | null;
  } | null;
};

type LabourItem = {
  id: string;
  labour_description?: string | null;
  calculation_method?: string | null;
  total_hours?: number | string | null;
  number_of_workers?: number | string | null;
  number_of_days?: number | string | null;
  hours_per_day?: number | string | null;
  work_type?: string | null;
  regular_hours?: number | string | null;
  overtime_hours?: number | string | null;
  regular_cost?: number | string | null;
  overtime_cost?: number | string | null;
  total_cost?: number | string | null;
};

type ScopeCharge = {
  id: string;
  description?: string | null;
  amount?: number | string | null;
};

type Scope = {
  id: string;
  scope_title?: string | null;
  scope_description?: string | null;
  labour_calculation_method?: string | null;
  regular_hourly_rate?: number | string | null;
  overtime_hourly_rate?: number | string | null;
  material_total?: number | string | null;
  material_profit_total?: number | string | null;
  labour_total?: number | string | null;
  additional_charges_total?: number | string | null;
  scope_subtotal_before_discount?: number | string | null;
  discount_type?: string | null;
  discount_value?: number | string | null;
  discount_amount?: number | string | null;
  scope_total_after_discount?: number | string | null;
  material_items: MaterialItem[];
  labour_items: LabourItem[];
  scope_charges: ScopeCharge[];
};

const cardClass =
  "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const labelClass =
  "text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";

function formatStatus(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPlainDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatCurrency(value: number | string | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));

  if (!Number.isFinite(numberValue)) {
    return "-";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(numberValue);
}

function profileName(profile: Profile | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const quotationId = params.id;
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadQuotation() {
      setError(null);
      setIsLoading(true);

      try {
        const response = await fetch(`/api/org/quotations/${quotationId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | (QuotationDetail & { error?: string })
          | null;

        if (!response.ok || !payload?.quotation) {
          setError(payload?.error ?? "Unable to load quotation.");
          return;
        }

        setDetail(payload);
        setStatusValue(payload.quotation.status ?? "draft");
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load quotation.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadQuotation();

    return () => {
      controller.abort();
    };
  }, [quotationId, refreshKey]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl rounded-lg border border-zinc-200 bg-white p-8 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        Loading quotation...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error ?? "Quotation not found."}
        </div>
        <Link
          className="mt-4 inline-flex text-sm font-medium text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
          href="/dashboard/quotations"
        >
          Back to Quotations
        </Link>
      </div>
    );
  }

  const quotation = detail.quotation;

  async function updateStatus() {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(`/api/org/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to update status.");
        return;
      }

      setRefreshKey((key) => key + 1);
    } catch {
      setError("Unable to update status.");
    } finally {
      setIsWorking(false);
    }
  }

  async function createRevision() {
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(`/api/org/quotations/${quotationId}/revision`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to create revision snapshot.");
        return;
      }

      setRefreshKey((key) => key + 1);
    } catch {
      setError("Unable to create revision snapshot.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-6 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {quotation.quotation_number ?? "Pending Quotation"}
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {quotation.customer?.company_name ?? "-"} ·{" "}
            {quotation.project_name ?? "No project name"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            href="/dashboard/quotations"
          >
            Back to Quotations
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            href={`/dashboard/quotations/${quotation.id}/edit`}
          >
            Edit
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <section className={cardClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
              {quotation.quotation_number ?? "Pending"}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              {quotation.project_name ?? "Untitled Project"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {quotation.customer?.company_name ?? "-"}
              {quotation.project_location
                ? ` · ${quotation.project_location}`
                : ""}
            </p>
          </div>
          <span className="inline-flex rounded-full border border-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
            {formatStatus(quotation.status)}
          </span>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Quote Date" value={formatPlainDate(quotation.quote_date)} />
        <SummaryCard label="Expiry Date" value={formatPlainDate(quotation.expiry_date)} />
        <SummaryCard label="Prepared By" value={profileName(quotation.prepared_by_profile)} />
        <SummaryCard label="Sales Rep" value={profileName(quotation.sales_rep_profile)} />
        <SummaryCard
          label="Grand Total"
          value={formatCurrency(
            quotation.grand_total_after_tax ??
              quotation.grand_total_before_tax ??
              quotation.grand_total,
          )}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Selected Customer Contacts
          </h2>
          <div className="mt-5 space-y-3">
            {detail.contacts.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                No contacts selected.
              </p>
            ) : (
              detail.contacts.map((contact, index) => (
                <div
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                  key={contact.id ?? index}
                >
                  <p className="font-medium text-zinc-950 dark:text-zinc-50">
                    {contact.contact_name_snapshot ?? "-"}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {contact.email_snapshot || "-"} ·{" "}
                    {contact.phone_snapshot || "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Header Details
          </h2>
          <div className="mt-5 grid gap-4">
            <DetailRow label="Customer RFQ Number" value={quotation.customer_rfq_number ?? "-"} />
            <DetailRow label="Revision Number" value={String(quotation.revision_number ?? 0)} />
            <DetailRow label="Customer Code" value={quotation.customer?.customer_code ?? "-"} />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Scopes of Work
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Read-only scope, material, labour, and charge details.
            </p>
          </div>
          {detail.scopes.length === 0 ? (
            <div className={cardClass}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No scopes added yet.
              </p>
            </div>
          ) : (
            detail.scopes.map((scope, index) => (
              <ScopeCard key={scope.id} scope={scope} scopeNumber={index + 1} />
            ))
          )}
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <div className={cardClass}>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Final Summary
            </h2>
            {detail.tax_warning ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {detail.tax_warning}
              </p>
            ) : null}
            <div className="mt-5 space-y-3">
              <SummaryLine
                label="Material Total"
                value={formatCurrency(quotation.material_total)}
              />
              <SummaryLine
                label="Material Profit"
                value={formatCurrency(quotation.material_profit_total)}
              />
              <SummaryLine
                label="Labour Total"
                value={formatCurrency(quotation.labour_total)}
              />
              <SummaryLine
                label="Additional Charges"
                value={formatCurrency(
                  quotation.scope_additional_charges_total,
                )}
              />
              <SummaryLine
                label="Scope Discounts"
                value={formatCurrency(quotation.scopes_discount_total)}
              />
              <SummaryLine
                label="Final Discount"
                value={`-${formatCurrency(quotation.final_discount_amount)}`}
              />
              <SummaryLine
                label="Final Additional Charges"
                value={formatCurrency(
                  quotation.final_additional_charges_total,
                )}
              />
              <SummaryLine
                label="Tax"
                value={formatCurrency(quotation.tax_amount)}
              />
              <div className="border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <SummaryLine
                  label="Grand Total"
                  strong
                  value={formatCurrency(quotation.grand_total_after_tax)}
                />
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Final Additional Charges
          </h2>
          <div className="mt-5 space-y-3">
            {detail.final_adjustments.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No final additional charges.
              </p>
            ) : (
              detail.final_adjustments.map((adjustment) => (
                <SummaryLine
                  key={adjustment.id}
                  label={adjustment.description ?? "Additional Charge"}
                  value={formatCurrency(adjustment.calculated_amount)}
                />
              ))
            )}
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Tax Summary
          </h2>
          <div className="mt-5 space-y-3">
            <SummaryLine
              label="Tax Name"
              value={quotation.tax_name ?? "No tax"}
            />
            <SummaryLine
              label="Tax Rate"
              value={`${quotation.tax_rate ?? 0}%`}
            />
            <SummaryLine
              label="Before Tax"
              value={formatCurrency(quotation.grand_total_before_tax)}
            />
            <SummaryLine
              label="Tax Amount"
              value={formatCurrency(quotation.tax_amount)}
            />
            <SummaryLine
              label="After Tax"
              strong
              value={formatCurrency(quotation.grand_total_after_tax)}
            />
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <TimelineCard
          emptyText="No status history yet."
          items={detail.status_history.map((item) => ({
            id: item.id,
            title: formatStatus(item.new_status),
            meta: formatDateTime(item.created_at),
            body: item.change_note ?? undefined,
          }))}
          title="Status History"
        />
        <TimelineCard
          emptyText="No revision snapshots yet."
          items={detail.revisions.map((item) => ({
            id: item.id,
            title: `Revision ${item.revision_number ?? 0}`,
            meta: formatDateTime(item.created_at),
            body: item.quotation_number ?? undefined,
          }))}
          title="Revision History"
        />
      </section>

      <section className="mt-6">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Notes and Terms
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {detail.note_sections.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No notes or terms saved.
              </p>
            ) : (
              detail.note_sections.map((section) => (
                <div
                  className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                  key={section.id}
                >
                  <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                    {section.title ?? formatStatus(section.section_type)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {section.body_text || "-"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:left-64">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-3">
          <select
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            value={statusValue}
            onChange={(event) => setStatusValue(event.target.value)}
          >
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            disabled={isWorking}
            type="button"
            onClick={() => void updateStatus()}
          >
            Change Status
          </button>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            disabled={isWorking}
            type="button"
            onClick={() => void createRevision()}
          >
            Create Revision Snapshot
          </button>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
            href={`/dashboard/quotations/${quotation.id}/edit`}
          >
            Edit
          </Link>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            href="/dashboard/quotations"
          >
            Back
          </Link>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={cardClass}>
      <p className={labelClass}>{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <p className="mt-1 text-sm text-zinc-950 dark:text-zinc-50">{value}</p>
    </div>
  );
}

function SummaryLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span
        className={
          strong
            ? "font-semibold text-zinc-950 dark:text-zinc-50"
            : "font-medium text-zinc-700 dark:text-zinc-200"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ScopeCard({
  scope,
  scopeNumber,
}: {
  scope: Scope;
  scopeNumber: number;
}) {
  return (
    <article className={cardClass}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            Scope of Work {scopeNumber}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {scope.scope_title ?? "Scope of Work"}
          </h3>
          {scope.scope_description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
              {scope.scope_description}
            </p>
          ) : null}
        </div>
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50">
          {formatCurrency(scope.scope_total_after_discount)}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <DetailRow
          label="Labour Method"
          value={formatStatus(scope.labour_calculation_method)}
        />
        <DetailRow
          label="Regular Rate"
          value={formatCurrency(scope.regular_hourly_rate)}
        />
        <DetailRow
          label="Overtime Rate"
          value={formatCurrency(scope.overtime_hourly_rate)}
        />
      </div>

      <ReadOnlyTable
        emptyText="No material rows."
        headers={[
          "Description",
          "Category",
          "Supplier",
          "Quote Ref",
          "Qty",
          "Unit",
          "Unit Cost",
          "Cost",
          "Profit",
          "Line Total",
          "Supplier PDF",
        ]}
        rows={scope.material_items.map((item) => [
          item.material_description ?? "-",
          item.material_category ?? "-",
          item.supplier_name ?? "-",
          item.supplier_quote_reference ?? "-",
          String(item.quantity ?? 0),
          item.unit ?? "-",
          formatCurrency(item.unit_cost),
          formatCurrency(item.material_cost),
          formatCurrency(item.profit_amount),
          formatCurrency(item.line_total),
          item.supplier_quote_document?.signed_url ? (
            <PdfLink
              fileName={item.supplier_quote_document.file_name}
              signedUrl={item.supplier_quote_document.signed_url}
            />
          ) : (
            "-"
          ),
        ])}
        title="Material Cost"
      />

      <ReadOnlyTable
        emptyText="No labour rows."
        headers={[
          "Description",
          "Method",
          "Work Type",
          "Regular Hours",
          "Overtime Hours",
          "Regular Cost",
          "Overtime Cost",
          "Total Cost",
        ]}
        rows={scope.labour_items.map((item) => [
          item.labour_description ?? "-",
          formatStatus(item.calculation_method),
          formatStatus(item.work_type),
          String(item.regular_hours ?? 0),
          String(item.overtime_hours ?? 0),
          formatCurrency(item.regular_cost),
          formatCurrency(item.overtime_cost),
          formatCurrency(item.total_cost),
        ])}
        title="Labour Cost"
      />

      <ReadOnlyTable
        emptyText="No additional charges."
        headers={["Description", "Amount"]}
        rows={scope.scope_charges.map((charge) => [
          charge.description ?? "-",
          formatCurrency(charge.amount),
        ])}
        title="Additional Charges"
      />

      <div className="mt-5 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          Scope Totals
        </h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SummaryLine
            label="Material Total"
            value={formatCurrency(scope.material_total)}
          />
          <SummaryLine
            label="Material Profit"
            value={formatCurrency(scope.material_profit_total)}
          />
          <SummaryLine
            label="Labour Total"
            value={formatCurrency(scope.labour_total)}
          />
          <SummaryLine
            label="Additional Charges"
            value={formatCurrency(scope.additional_charges_total)}
          />
          <SummaryLine
            label="Subtotal Before Discount"
            value={formatCurrency(scope.scope_subtotal_before_discount)}
          />
          <SummaryLine
            label="Discount"
            value={formatCurrency(scope.discount_amount)}
          />
          <SummaryLine
            label="Scope Total After Discount"
            strong
            value={formatCurrency(scope.scope_total_after_discount)}
          />
        </div>
      </div>
    </article>
  );
}

function ReadOnlyTable({
  title,
  headers,
  rows,
  emptyText,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
  emptyText: string;
}) {
  return (
    <section className="mt-5 rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h4>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-zinc-500 dark:text-zinc-400">
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                {headers.map((header) => (
                  <th className="px-4 py-2 font-semibold" key={header}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td
                      className="px-4 py-3 text-zinc-700 dark:text-zinc-300"
                      key={`${rowIndex}-${cellIndex}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PdfLink({
  fileName,
  signedUrl,
}: {
  fileName: string;
  signedUrl: string;
}) {
  return (
    <div className="flex min-w-44 flex-wrap items-center gap-2">
      <span className="max-w-32 truncate text-xs font-medium">{fileName}</span>
      <button
        className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        type="button"
        onClick={() => window.open(signedUrl, "_blank")}
      >
        View
      </button>
    </div>
  );
}

function TimelineCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta: string; body?: string }>;
  emptyText: string;
}) {
  return (
    <div className={cardClass}>
      <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {emptyText}
          </p>
        ) : (
          items.map((item) => (
            <div
              className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
              key={item.id}
            >
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {item.title}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {item.meta}
              </p>
              {item.body ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {item.body}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
