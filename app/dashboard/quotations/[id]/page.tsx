"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChevronRightIcon,
  DownloadIcon,
  FileTextIcon,
  GitCompareIcon,
  LockIcon,
  PrinterIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  formatCurrency,
  formatDateTime,
  formatPlainDate,
  formatStatus,
  QuotationStatusBadge,
  quotationStatuses,
  SectionCard,
} from "../quotation-ui";
import {
  downloadQuotationPdf,
  printQuotation,
} from "../quotation-document";

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
  is_locked?: boolean | null;
  quotation_series_id?: string | null;
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
  series_revisions?: SeriesRevision[];
  revision_audit?: AuditEvent[];
  tax_warning?: string | null;
};

type SeriesRevision = {
  id: string;
  revision_number?: number | string | null;
  revision_purpose?: string | null;
  revision_created_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  is_locked?: boolean | null;
  created_by_profile?: Profile | null;
};

type AuditEvent = {
  id: string;
  revision_number?: number | string | null;
  event_type?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
  actor_profile?: Profile | null;
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

type GeneratedCustomerDocument = {
  id: string;
  revision_number?: number | string | null;
  file_name?: string | null;
  generated_at?: string | null;
  signed_url?: string | null;
  generated_by_profile?: Profile | null;
};

type MaterialItem = {
  id: string;
  material_description?: string | null;
  material_category?: string | null;
  supplier_name?: string | null;
  supplier_quote_reference?: string | null;
  quantity?: number | string | null;
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
  profit_type?: string | null;
  profit_value?: number | string | null;
  profit_amount?: number | string | null;
  line_total?: number | string | null;
  supporting_document?: {
    id: string;
    file_name: string;
    signed_url?: string | null;
  } | null;
};

type Scope = {
  id: string;
  scope_title?: string | null;
  scope_description?: string | null;
  quantity?: number | string | null;
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

function profileName(profile: Profile | null | undefined) {
  if (!profile) {
    return "-";
  }

  return profile.full_name || profile.email || "-";
}

function statusChangeWarning(status: string) {
  switch (status) {
    case "sent":
      return "This quotation revision will become read-only after it is sent. Further changes will require creating a new revision.";
    case "accepted":
      return "This quotation will be marked as accepted.";
    case "rejected":
      return "This quotation will be marked as rejected.";
    case "expired":
      return "This quotation will be marked as expired.";
    case "converted_to_work_order":
      return "This quotation will be marked as converted to a work order.";
    default:
      return "The quotation status will be updated after confirmation.";
  }
}

export default function QuotationDetailPage() {
  const params = useParams<{ id: string }>();
  const quotationId = params.id;
  const [detail, setDetail] = useState<QuotationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusValue, setStatusValue] = useState("");
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasCustomerQuotation, setHasCustomerQuotation] = useState(false);
  const [generatedCustomerDocuments, setGeneratedCustomerDocuments] = useState<
    GeneratedCustomerDocument[]
  >([]);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionPurpose, setRevisionPurpose] = useState("");

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

        const [customerQuotationResponse, generatedResponse] =
          await Promise.all([
            fetch(
              `/api/org/quotations/${quotationId}/customer-quotation`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
            fetch(
              `/api/org/quotations/${quotationId}/customer-quotation/generated-documents`,
              {
                cache: "no-store",
                signal: controller.signal,
              },
            ),
          ]);

        if (customerQuotationResponse.ok) {
          const customerQuotationPayload =
            (await customerQuotationResponse.json()) as { exists?: boolean };
          setHasCustomerQuotation(Boolean(customerQuotationPayload.exists));
        }

        if (generatedResponse.ok) {
          const generatedPayload = (await generatedResponse.json()) as {
            documents?: GeneratedCustomerDocument[];
          };
          setGeneratedCustomerDocuments(generatedPayload.documents ?? []);
        }
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

  useEffect(() => {
    if (!successMessage) return;

    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

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
  const contacts = detail.contacts ?? [];
  const scopes = detail.scopes ?? [];
  const finalAdjustments = detail.final_adjustments ?? [];
  const noteSections = detail.note_sections ?? [];
  const statusHistory = detail.status_history ?? [];
  const revisions = detail.series_revisions ?? [];
  const auditHistory = detail.revision_audit ?? [];
  const printableDetail = detail;

  async function updateStatus() {
    if (!pendingStatus || isChangingStatus) return;
    const confirmedStatus = pendingStatus;
    setError(null);
    setSuccessMessage(null);
    setIsChangingStatus(true);

    try {
      const response = await fetch(`/api/org/quotations/${quotationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: confirmedStatus }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { quotation?: Quotation; error?: string }
        | null;

      if (!response.ok || !payload?.quotation) {
        setError(payload?.error ?? "Unable to update status.");
        setPendingStatus(null);
        setStatusDialogOpen(false);
        return;
      }

      const savedStatus = payload.quotation.status ?? confirmedStatus;
      setStatusValue(savedStatus);
      setPendingStatus(null);
      setStatusDialogOpen(false);
      setSuccessMessage(
        `Quotation status changed to ${formatStatus(savedStatus)}.`,
      );
      setRefreshKey((key) => key + 1);
    } catch {
      setError("Unable to update status.");
      setPendingStatus(null);
      setStatusDialogOpen(false);
    } finally {
      setIsChangingStatus(false);
    }
  }

  function selectPendingStatus(value: unknown) {
    const nextStatus = String(value ?? "");
    if (!nextStatus || nextStatus === statusValue) return;
    setPendingStatus(nextStatus);
    setStatusDialogOpen(true);
  }

  function cancelStatusChange() {
    if (isChangingStatus) return;
    setPendingStatus(null);
    setStatusDialogOpen(false);
  }

  async function createRevision() {
    if (!revisionPurpose.trim()) {
      setError("Purpose of revision is required.");
      return;
    }
    setError(null);
    setIsWorking(true);

    try {
      const response = await fetch(`/api/org/quotations/${quotationId}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: revisionPurpose.trim() }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { quotation_id?: string; error?: string }
        | null;

      if (!response.ok) {
        setError(payload?.error ?? "Unable to create revision.");
        return;
      }
      if (payload?.quotation_id) window.location.assign(`/dashboard/quotations/${payload.quotation_id}`);
    } catch {
      setError("Unable to create revision.");
    } finally {
      setIsWorking(false);
    }
  }

  function handlePrint() {
    setError(null);

    if (!printQuotation(printableDetail)) {
      setError("Unable to open the print window. Please allow pop-ups and try again.");
    }
  }

  async function handleDownloadPdf() {
    setError(null);
    setIsDownloading(true);

    try {
      await downloadQuotationPdf(printableDetail);
    } catch {
      setError("Unable to generate the quotation PDF.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Quotation {quotation.quotation_number ?? "Pending"} · Revision {quotation.revision_number ?? 0}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {quotation.customer?.company_name ?? "-"} ·{" "}
            {quotation.project_name ?? "No project name"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-10 rounded-md"
            nativeButton={false}
            render={
              <Link
                href={`/dashboard/quotations/${quotation.id}/customer-quotation`}
              />
            }
          >
            <FileTextIcon className="size-4" />
            {quotation.is_locked
              ? "View Customer Quotation"
              : hasCustomerQuotation
              ? "Edit Customer Quotation"
              : "Prepare Customer Quotation"}
          </Button>
          {quotation.status === "sent" ? <Button className="h-10 rounded-md" type="button" variant="outline" onClick={() => setRevisionDialogOpen(true)}>Create Revision</Button> : null}
          <Button className="h-10 rounded-md" nativeButton={false} render={<Link href={`/dashboard/quotations/${quotation.id}/compare`} />} variant="outline"><GitCompareIcon className="size-4" />Compare Revisions</Button>
          {!quotation.is_locked ? <Button
            className="h-10 rounded-md"
            type="button"
            variant="outline"
            onClick={handlePrint}
          >
            <PrinterIcon className="size-4" />
            Print
          </Button> : null}
          <Button
            className="h-10 rounded-md"
            disabled={isDownloading}
            type="button"
            variant="outline"
            onClick={() => void handleDownloadPdf()}
          >
            <DownloadIcon className="size-4" />
            {isDownloading ? "Preparing PDF..." : "Download PDF"}
          </Button>
          <Button
            className="h-10 rounded-md"
            nativeButton={false}
            render={<Link href="/dashboard/quotations" />}
            variant="outline"
          >
            Back to Quotations
          </Button>
          <Button
            className="h-10 rounded-md font-semibold"
            nativeButton={false}
            render={<Link href={`/dashboard/quotations/${quotation.id}/edit`} />}
          >
            Edit
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div
          aria-live="polite"
          className="fixed right-4 top-4 z-[70] max-w-sm rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-200"
          role="status"
        >
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
              {quotation.quotation_number ?? "Pending"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              {quotation.project_name ?? "Untitled Project"}
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {quotation.customer?.company_name ?? "-"}
              {quotation.project_location
                ? ` · ${quotation.project_location}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2"><Badge variant="outline">Revision {quotation.revision_number ?? 0}</Badge><QuotationStatusBadge className="h-7 px-3 text-sm" status={quotation.status} />{quotation.is_locked ? <Badge variant="secondary"><LockIcon className="size-3" />Locked</Badge> : null}</div>
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
        <SectionCard title="Selected Customer Contacts">
          <div className="space-y-3">
            {contacts.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                No contacts selected.
              </p>
            ) : (
              contacts.map((contact, index) => (
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
        </SectionCard>

        <SectionCard title="Header Details">
          <div className="grid gap-4">
            <DetailRow label="Customer RFQ Number" value={quotation.customer_rfq_number ?? "-"} />
            <DetailRow label="Revision Number" value={String(quotation.revision_number ?? 0)} />
            <DetailRow label="Customer Code" value={quotation.customer?.customer_code ?? "-"} />
          </div>
        </SectionCard>
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
          {scopes.length === 0 ? (
            <div className={cardClass}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No scopes added yet.
              </p>
            </div>
          ) : (
            scopes.map((scope, index) => (
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
            {finalAdjustments.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No final additional charges.
              </p>
            ) : (
              finalAdjustments.map((adjustment) => (
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
          items={statusHistory.map((item) => ({
            id: item.id,
            title: formatStatus(item.new_status),
            meta: formatDateTime(item.created_at),
            body: item.change_note ?? undefined,
          }))}
          title="Status History"
        />
        <div className={cardClass}><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Revision History</h2><Button size="sm" nativeButton={false} render={<Link href={`/dashboard/quotations/${quotation.id}/compare`} />} variant="outline">Compare</Button></div><div className="mt-4 space-y-2">{revisions.map((item) => <Link className="block rounded-md border border-zinc-200 p-3 transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900" href={`/dashboard/quotations/${item.id}`} key={item.id}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">Rev {item.revision_number ?? 0}</span><span className="text-xs text-zinc-500">{item.is_locked ? "Locked" : "Editable"}</span></div><p className="mt-1 text-sm text-zinc-600">{Number(item.revision_number ?? 0) === 0 ? "Original Quotation" : `Purpose: ${item.revision_purpose || "—"}`}</p><p className="mt-1 text-xs text-zinc-500">{formatStatus(item.status)} · {formatDateTime(item.revision_created_at ?? item.created_at)} · {profileName(item.created_by_profile)}</p></Link>)}{revisions.length === 0 ? <p className="text-sm text-zinc-500">No revision history.</p> : null}</div></div>
      </section>

      {auditHistory.length ? <section className="mt-6"><TimelineCard emptyText="No audit activity." items={auditHistory.map((event) => ({ id: event.id, title: `${formatStatus(event.event_type)} · Rev ${event.revision_number ?? 0}`, meta: `${formatDateTime(event.created_at)} · ${profileName(event.actor_profile)}`, body: event.metadata ? JSON.stringify(event.metadata) : undefined }))} title="Audit History" /></section> : null}

      <section className="mt-6">
        <div className={cardClass}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                Customer Quotation Documents
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Customer-ready PDFs generated from the separate sales draft.
              </p>
            </div>
            <Button
              className="rounded-md"
              nativeButton={false}
              render={
                <Link
                  href={`/dashboard/quotations/${quotation.id}/customer-quotation`}
                />
              }
            >
              <FileTextIcon className="size-4" />
              {hasCustomerQuotation ? "Edit Draft" : "Prepare Quotation"}
            </Button>
          </div>
          {generatedCustomerDocuments.length === 0 ? (
            <p className="mt-5 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No customer quotation PDFs generated yet.
            </p>
          ) : (
            <div className="mt-5 divide-y divide-zinc-200 dark:divide-zinc-800">
              {generatedCustomerDocuments.map((document) => {
                const signedUrl = document.signed_url;

                return (
                  <div
                    className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                    key={document.id}
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        Revision {document.revision_number ?? 0}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {formatDateTime(document.generated_at)} ·{" "}
                        {profileName(document.generated_by_profile)}
                      </p>
                    </div>
                    {signedUrl ? (
                      <div className="flex gap-2">
                        <Button
                          className="rounded-md"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              signedUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          View PDF
                        </Button>
                        <Button
                          className="rounded-md"
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => {
                            const printWindow = window.open(
                              signedUrl,
                              "_blank",
                              "noopener,noreferrer",
                            );
                            printWindow?.addEventListener("load", () =>
                              printWindow.print(),
                            );
                          }}
                        >
                          <PrinterIcon className="size-4" />
                          Print
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="mt-6">
        <div className={cardClass}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Notes and Terms
          </h2>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {noteSections.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No notes or terms saved.
              </p>
            ) : (
              noteSections.map((section) => (
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
          <Button
            className="h-10 rounded-md"
            nativeButton={false}
            render={
              <Link
                href={`/dashboard/quotations/${quotation.id}/customer-quotation`}
              />
            }
            variant="outline"
          >
            <FileTextIcon className="size-4" />
            Customer Quotation
          </Button>
          <Button
            className="h-10 rounded-md"
            type="button"
            variant="outline"
            onClick={handlePrint}
          >
            <PrinterIcon className="size-4" />
            Print
          </Button>
          <Button
            className="h-10 rounded-md"
            disabled={isDownloading}
            type="button"
            variant="outline"
            onClick={() => void handleDownloadPdf()}
          >
            <DownloadIcon className="size-4" />
            {isDownloading ? "Preparing PDF..." : "Download PDF"}
          </Button>
          {!quotation.is_locked ? <><Select
            disabled={isChangingStatus}
            value={statusValue}
            onValueChange={selectPendingStatus}
          >
            <SelectTrigger className="h-10 w-full rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 sm:w-56">
              <SelectValue placeholder="Change status" />
            </SelectTrigger>
            <SelectContent align="start">
              {quotationStatuses.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select></> : null}
          {quotation.status === "sent" ? <Button className="h-10 rounded-md" type="button" variant="outline" onClick={() => setRevisionDialogOpen(true)}>Create Revision</Button> : null}
          {!quotation.is_locked ? <Button
            className="h-10 rounded-md font-semibold"
            nativeButton={false}
            render={<Link href={`/dashboard/quotations/${quotation.id}/edit`} />}
          >
            Edit
          </Button> : null}
          <Button
            className="h-10 rounded-md"
            nativeButton={false}
            render={<Link href="/dashboard/quotations" />}
            variant="outline"
          >
            Back
          </Button>
        </div>
      </div>

      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="rounded-lg"><DialogHeader><DialogTitle>Create New Revision</DialogTitle><DialogDescription>Quotation {quotation.quotation_number ?? "—"} · Current Revision {quotation.revision_number ?? 0}</DialogDescription></DialogHeader><div><label className="text-sm font-medium" htmlFor="revision-purpose">Purpose of Revision</label><Textarea className="mt-2 min-h-28" id="revision-purpose" placeholder="Customer requested additional work\nMaterial specification updated\nQuantity revised\nPrice adjustment\nDrawing revision\nScope of work modified" required value={revisionPurpose} onChange={(event) => setRevisionPurpose(event.target.value)} /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)}>Cancel</Button><Button disabled={isWorking || !revisionPurpose.trim()} type="button" onClick={() => void createRevision()}>{isWorking ? "Creating..." : "Create Revision"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog
        open={statusDialogOpen}
        onOpenChange={(open) => {
          if (!open) cancelStatusChange();
        }}
      >
        <DialogContent className="rounded-lg" showCloseButton={!isChangingStatus}>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Change quotation status from &quot;{formatStatus(statusValue)}&quot; to
              &quot;{formatStatus(pendingStatus)}&quot;?
            </DialogDescription>
          </DialogHeader>
          {pendingStatus ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              {statusChangeWarning(pendingStatus)}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={isChangingStatus}
              type="button"
              variant="outline"
              onClick={cancelStatusChange}
            >
              Cancel
            </Button>
            <Button
              disabled={isChangingStatus || !pendingStatus}
              type="button"
              onClick={() => void updateStatus()}
            >
              {isChangingStatus ? "Changing Status..." : "Yes, Change Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
  const materialItems = scope.material_items ?? [];
  const labourItems = scope.labour_items ?? [];
  const scopeCharges = scope.scope_charges ?? [];

  return (
    <details
      className="group overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      open
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 dark:hover:bg-zinc-900/60 [&::-webkit-details-marker]:hidden sm:px-5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-lg text-zinc-500 transition group-open:rotate-90 dark:border-zinc-700 dark:text-zinc-400">
          <ChevronRightIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Scope {scopeNumber}
          </span>
          <span className="block truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
            {scope.scope_title ?? "Scope of Work"}
          </span>
        </span>
        <span className="text-right">
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Scope total
          </span>
          <span className="block text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
            {formatCurrency(scope.scope_total_after_discount)}
          </span>
        </span>
      </summary>

      <div className="border-t border-zinc-200 p-4 dark:border-zinc-800 sm:p-5">
        {scope.scope_description ? (
          <div className="mb-5">
            <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
              Scope Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {scope.scope_description}
            </p>
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-2 lg:grid-cols-5">
          <ScopeMetric label="Scope Quantity" value={String(scope.quantity ?? 1)} />
          <ScopeMetric
            label="Calculated Unit Price"
            value={formatCurrency(
              Number(scope.scope_total_after_discount ?? 0) /
                (Number(scope.quantity ?? 1) || 1),
            )}
          />
          <ScopeMetric
            label="Labour Method"
            value={formatStatus(scope.labour_calculation_method)}
          />
          <ScopeMetric
            label="Regular Hourly Rate"
            value={formatCurrency(scope.regular_hourly_rate)}
          />
          <ScopeMetric
            label="Overtime Hourly Rate"
            value={formatCurrency(scope.overtime_hourly_rate)}
          />
        </div>

        <Tabs defaultValue="materials">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md bg-zinc-100 p-1 dark:bg-zinc-900">
            <TabsTrigger
              className="h-8 flex-none rounded-sm px-3"
              value="materials"
            >
              Materials
              <ScopeTabCount value={materialItems.length} />
            </TabsTrigger>
            <TabsTrigger
              className="h-8 flex-none rounded-sm px-3"
              value="labour"
            >
              Labour
              <ScopeTabCount value={labourItems.length} />
            </TabsTrigger>
            <TabsTrigger
              className="h-8 flex-none rounded-sm px-3"
              value="charges"
            >
              Additional Charges
              <ScopeTabCount value={scopeCharges.length} />
            </TabsTrigger>
            <TabsTrigger
              className="h-8 flex-none rounded-sm px-3"
              value="summary"
            >
              Summary
            </TabsTrigger>
          </TabsList>

          <TabsContent className="pt-4" value="materials">
            <ReadOnlyTable
              emptyText="No material rows in this scope."
              headers={[
                "Description",
                "Category",
                "Supplier",
                "Quote Ref",
                "Qty",
                "Unit Cost",
                "Material Cost",
                "Profit",
                "Line Total",
                "Supplier PDF",
              ]}
              rows={materialItems.map((item) => [
                item.material_description ?? "-",
                item.material_category ?? "-",
                item.supplier_name ?? "-",
                item.supplier_quote_reference ?? "-",
                String(item.quantity ?? 0),
                formatCurrency(item.unit_cost),
                formatCurrency(item.material_cost),
                formatCurrency(item.profit_amount),
                formatCurrency(item.line_total),
                item.supplier_quote_document?.signed_url ? (
                  <PdfLink
                    fileName={item.supplier_quote_document.file_name}
                    key="pdf"
                    signedUrl={item.supplier_quote_document.signed_url}
                  />
                ) : (
                  "-"
                ),
              ])}
              title="Material Cost"
            />
          </TabsContent>

          <TabsContent className="pt-4" value="labour">
            <ReadOnlyTable
              emptyText="No labour rows in this scope."
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
              rows={labourItems.map((item) => [
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
          </TabsContent>

          <TabsContent className="pt-4" value="charges">
            <ReadOnlyTable
              emptyText="No additional charges in this scope."
              headers={[
                "Description",
                "Base Amount",
                "Profit Type",
                "Profit Value",
                "Profit Amount",
                "Line Total",
                "Supporting PDF",
              ]}
              rows={scopeCharges.map((charge) => [
                charge.description ?? "-",
                formatCurrency(charge.amount),
                formatStatus(charge.profit_type),
                charge.profit_type === "percentage"
                  ? `${charge.profit_value ?? 0}%`
                  : formatCurrency(charge.profit_value),
                formatCurrency(charge.profit_amount),
                formatCurrency(charge.line_total),
                charge.supporting_document?.signed_url ? (
                  <PdfLink
                    fileName={charge.supporting_document.file_name}
                    key="pdf"
                    signedUrl={charge.supporting_document.signed_url}
                  />
                ) : (
                  "-"
                ),
              ])}
              title="Additional Charges"
            />
          </TabsContent>

          <TabsContent className="pt-4" value="summary">
            <div className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/60 sm:grid-cols-2">
              <ScopeSummaryTile
                label="Material Total"
                value={formatCurrency(scope.material_total)}
              />
              <ScopeSummaryTile
                label="Material Profit"
                value={formatCurrency(scope.material_profit_total)}
              />
              <ScopeSummaryTile
                label="Labour Total"
                value={formatCurrency(scope.labour_total)}
              />
              <ScopeSummaryTile
                label="Additional Charges"
                value={formatCurrency(scope.additional_charges_total)}
              />
              <ScopeSummaryTile
                label="Subtotal Before Discount"
                value={formatCurrency(scope.scope_subtotal_before_discount)}
              />
              <ScopeSummaryTile
                label="Discount"
                value={`-${formatCurrency(scope.discount_amount)}`}
              />
              <ScopeSummaryTile
                label="Calculated Unit Price"
                value={formatCurrency(
                  Number(scope.scope_total_after_discount ?? 0) /
                    (Number(scope.quantity ?? 1) || 1),
                )}
              />
              <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700 sm:col-span-2">
                <SummaryLine
                  label="Scope Total"
                  strong
                  value={formatCurrency(scope.scope_total_after_discount)}
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </details>
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
    <section className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
          {title}
        </h4>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {emptyText}
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  {headers.map((header) => (
                    <th className="px-4 py-2 font-medium" key={header}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {rows.map((row, rowIndex) => (
                  <tr
                    className="transition hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    key={rowIndex}
                  >
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
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 md:hidden">
            {rows.map((row, rowIndex) => (
              <div className="space-y-3 p-4" key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <div
                    className="flex items-start justify-between gap-4 text-sm"
                    key={`${rowIndex}-${cellIndex}`}
                  >
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {headers[cellIndex]}
                    </span>
                    <span className="min-w-0 text-right font-medium text-zinc-700 dark:text-zinc-200">
                      {cell}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ScopeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function ScopeSummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function ScopeTabCount({ value }: { value: number }) {
  return (
    <span className="rounded-sm bg-zinc-200 px-1.5 py-0.5 text-[10px] leading-none text-zinc-600 dark:bg-zinc-700 dark:text-zinc-200">
      {value}
    </span>
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
