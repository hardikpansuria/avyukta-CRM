"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileDownIcon,
  SaveIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { CustomerQuotationPreview } from "./customer-quotation-preview";
import { RichTextEditor } from "./rich-text-editor";

type CustomerDocument = {
  id?: string;
  document_status?: string;
  quotation_date: string;
  quotation_number_snapshot: string;
  revision_number_snapshot: number | string;
  customer_name_snapshot: string;
  address_line_1_snapshot: string;
  city_snapshot: string;
  province_snapshot: string;
  postal_code_snapshot: string;
  attendee_name_snapshot: string;
  attendee_email_snapshot: string;
  delivery_text: string;
  terms_text: string;
  fob_text: string;
  prepared_by_id?: string | null;
  prepared_by_name_snapshot: string;
  subtotal: number;
  discount_amount: number;
  final_additional_charges_total: number;
  grand_total_before_tax: number;
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
  total: number;
};

type CustomerItem = {
  id?: string;
  scope_id: string;
  sort_order: number;
  scope_title_snapshot: string;
  description_html: string;
  description_text: string;
  imported_scope_amount: number;
  estimation_quantity: number;
  quantity: number;
  price_each: number;
  price_ext: number;
};

type Organization = {
  company_name: string;
  phone: string;
  fax: string;
  footer_text: string;
  terms_html: string;
  terms_text: string;
  logo_signed_url: string | null;
  has_logo: boolean;
};

type GeneratedDocument = {
  id: string;
  revision_number?: number | string | null;
  file_name?: string | null;
  file_size?: number | string | null;
  generated_at?: string | null;
  signed_url?: string | null;
  generated_by_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ApiPayload = {
  exists: boolean;
  document: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  organization: Organization;
  source_scopes: Array<Record<string, unknown>>;
  pricing_summary: Record<string, unknown>;
  error?: string;
};

const steps = [
  "Company Branding",
  "Customer Details",
  "Quotation Details",
  "Scope & Pricing",
  "Commercial Terms",
  "Preview & Generate PDF",
];

const inputClass =
  "h-10 rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900";

function stringValue(value: unknown) {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(numberValue(value));
}

function hydrateDocument(value: Record<string, unknown>): CustomerDocument {
  return {
    id: stringValue(value.id) || undefined,
    document_status: stringValue(value.document_status) || "draft",
    quotation_date: stringValue(value.quotation_date),
    quotation_number_snapshot: stringValue(value.quotation_number_snapshot),
    revision_number_snapshot: numberValue(value.revision_number_snapshot),
    customer_name_snapshot: stringValue(value.customer_name_snapshot),
    address_line_1_snapshot: stringValue(value.address_line_1_snapshot),
    city_snapshot: stringValue(value.city_snapshot),
    province_snapshot: stringValue(value.province_snapshot),
    postal_code_snapshot: stringValue(value.postal_code_snapshot),
    attendee_name_snapshot: stringValue(value.attendee_name_snapshot),
    attendee_email_snapshot: stringValue(value.attendee_email_snapshot),
    delivery_text: stringValue(value.delivery_text),
    terms_text: stringValue(value.terms_text),
    fob_text: stringValue(value.fob_text),
    prepared_by_id: stringValue(value.prepared_by_id) || null,
    prepared_by_name_snapshot: stringValue(
      value.prepared_by_name_snapshot,
    ),
    subtotal: numberValue(value.subtotal),
    discount_amount: numberValue(value.discount_amount),
    final_additional_charges_total: numberValue(
      value.final_additional_charges_total,
    ),
    grand_total_before_tax: numberValue(value.grand_total_before_tax),
    tax_name: stringValue(value.tax_name ?? value.tax_name_snapshot),
    tax_rate: numberValue(value.tax_rate ?? value.tax_rate_snapshot),
    tax_amount: numberValue(value.tax_amount),
    total: numberValue(value.total),
  };
}

function hydrateItems(values: Array<Record<string, unknown>>): CustomerItem[] {
  return values.map((value, index) => ({
    id: stringValue(value.id) || undefined,
    scope_id: stringValue(value.scope_id),
    sort_order: index + 1,
    scope_title_snapshot:
      stringValue(value.scope_title_snapshot) || `Scope of Work ${index + 1}`,
    description_html: stringValue(value.description_html),
    description_text: stringValue(value.description_text),
    imported_scope_amount: numberValue(value.imported_scope_amount),
    estimation_quantity: numberValue(value.estimation_quantity, 1) || 1,
    quantity: numberValue(value.quantity, 1) || 1,
    price_each: numberValue(value.price_each),
    price_ext: numberValue(value.price_ext),
  }));
}

export function CustomerQuotationWizard({ readOnly = false }: { readOnly?: boolean }) {
  const params = useParams<{ id: string }>();
  const quotationId = params.id;
  const [activeStep, setActiveStep] = useState(0);
  const [exists, setExists] = useState(false);
  const [document, setDocument] = useState<CustomerDocument | null>(null);
  const [items, setItems] = useState<CustomerItem[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [generatedDocuments, setGeneratedDocuments] = useState<
    GeneratedDocument[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        const [draftResponse, historyResponse] = await Promise.all([
          fetch(`/api/org/quotations/${quotationId}/customer-quotation`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(
            `/api/org/quotations/${quotationId}/customer-quotation/generated-documents`,
            { cache: "no-store", signal: controller.signal },
          ),
        ]);
        const payload = (await draftResponse.json().catch(() => null)) as
          | ApiPayload
          | null;
        const historyPayload = (await historyResponse
          .json()
          .catch(() => null)) as
          | { documents?: GeneratedDocument[] }
          | null;

        if (!draftResponse.ok || !payload?.document) {
          setError(payload?.error ?? "Unable to load customer quotation.");
          return;
        }

        setExists(payload.exists);
        setDocument(
          hydrateDocument({ ...payload.document, ...payload.pricing_summary }),
        );
        setItems(hydrateItems(payload.items ?? []));
        setOrganization(payload.organization);
        setGeneratedDocuments(historyPayload?.documents ?? []);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Unable to load customer quotation.");
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [quotationId]);

  function updateDocument(updates: Partial<CustomerDocument>) {
    setDocument((current) => (current ? { ...current, ...updates } : current));
  }

  function updateItem(index: number, updates: Partial<CustomerItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item,
      ),
    );
  }

  function draftPayload() {
    if (!document) return null;

    return {
      quotation_date: document.quotation_date,
      customer_name_snapshot: document.customer_name_snapshot,
      address_line_1_snapshot: document.address_line_1_snapshot,
      city_snapshot: document.city_snapshot,
      province_snapshot: document.province_snapshot,
      postal_code_snapshot: document.postal_code_snapshot,
      attendee_name_snapshot: document.attendee_name_snapshot,
      attendee_email_snapshot: document.attendee_email_snapshot,
      delivery_text: document.delivery_text,
      terms_text: document.terms_text,
      fob_text: document.fob_text,
      items: items.map((item) => ({
        id: item.id,
        scope_id: item.scope_id,
        scope_title_snapshot: item.scope_title_snapshot,
        description_html: item.description_html,
        description_text: item.description_text,
      })),
    };
  }

  async function saveDraft(showSuccess = true) {
    const payload = draftPayload();
    if (!payload) return false;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/org/quotations/${quotationId}/customer-quotation`,
        {
          method: exists ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const saved = (await response.json().catch(() => null)) as
        | ApiPayload
        | null;

      if (!response.ok || !saved?.document) {
        setError(saved?.error ?? "Unable to save customer quotation draft.");
        return false;
      }

      setExists(true);
      setDocument(
        hydrateDocument({ ...saved.document, ...saved.pricing_summary }),
      );
      setItems(hydrateItems(saved.items ?? []));
      if (showSuccess) setSuccess("Customer quotation draft saved.");
      return true;
    } catch {
      setError("Unable to save customer quotation draft.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function generatePdf() {
    const saved = await saveDraft(false);
    if (!saved) return;

    setIsGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/org/quotations/${quotationId}/customer-quotation/generate-pdf`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { document?: GeneratedDocument; error?: string }
        | null;

      if (!response.ok || !payload?.document) {
        setError(payload?.error ?? "Unable to generate customer quotation PDF.");
        return;
      }

      setGeneratedDocuments((current) => [payload.document!, ...current]);
      setSuccess("Customer quotation PDF generated.");

      if (payload.document.signed_url) {
        window.open(payload.document.signed_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Unable to generate customer quotation PDF.");
    } finally {
      setIsGenerating(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <Skeleton className="h-12 w-80 rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-[520px] w-full rounded-md" />
      </div>
    );
  }

  if (!document || !organization) {
    return (
      <div className="mx-auto max-w-5xl rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        {error ?? "Customer quotation could not be loaded."}
      </div>
    );
  }

  const previewDocument = document;

  return (
    <div className="mx-auto max-w-7xl pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            href={`/dashboard/quotations/${quotationId}`}
          >
            <ArrowLeftIcon className="size-4" />
            Back to quotation
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Customer Quotation
            </h1>
            <Badge variant="outline">
              {readOnly ? "Locked revision" : exists ? "Draft saved" : "New draft"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Prepare the customer-facing scope, pricing, and commercial terms.
          </p>
        </div>
        {!readOnly ? <Button
          className="rounded-md"
          disabled={isSaving}
          type="button"
          variant="outline"
          onClick={() => void saveDraft()}
        >
          <SaveIcon className="size-4" />
          {isSaving ? "Saving..." : "Save Draft"}
        </Button> : null}
      </div>

      <nav
        aria-label="Customer quotation steps"
        className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <ol className="flex min-w-max items-center">
          {steps.map((step, index) => (
            <li className="flex items-center" key={step}>
              <button
                className={cn(
                  "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                  index === activeStep
                    ? "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50",
                )}
                type="button"
                onClick={() => setActiveStep(index)}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full border text-[10px]",
                    index < activeStep && "border-current",
                  )}
                >
                  {index < activeStep ? (
                    <CheckIcon className="size-3" />
                  ) : (
                    index + 1
                  )}
                </span>
                {step}
              </button>
              {index < steps.length - 1 ? (
                <span className="mx-1 h-px w-5 bg-zinc-200 dark:bg-zinc-800" />
              ) : null}
            </li>
          ))}
        </ol>
      </nav>

      {error ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </div>
      ) : null}

      <main className="mt-6">
        <fieldset disabled={readOnly}>
        {activeStep === 0 ? (
          <StepCard
            description="Organization-wide quotation branding is reused for every customer document."
            title="Company Branding"
          >
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
                {organization.logo_signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={organization.company_name}
                    className="max-h-28 max-w-full object-contain"
                    src={organization.logo_signed_url}
                  />
                ) : (
                  <p className="text-center text-sm text-zinc-500">
                    No organization logo configured
                  </p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReadOnlyField
                  label="Company Name"
                  value={organization.company_name}
                />
                <ReadOnlyField label="Phone" value={organization.phone || "-"} />
                <ReadOnlyField label="Fax" value={organization.fax || "-"} />
                <ReadOnlyField
                  label="Footer"
                  value={organization.footer_text || "-"}
                />
                <div className="sm:col-span-2">
                  <ReadOnlyField
                    label="Terms and Conditions"
                    value={
                      organization.terms_html || organization.terms_text
                        ? "Configured"
                        : "Not configured"
                    }
                  />
                </div>
              </div>
            </div>
          </StepCard>
        ) : null}

        {activeStep === 1 ? (
          <StepCard
            description="These values are snapshots for this customer quotation and do not update the customer record."
            title="Customer Details"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <TextField
                required
                label="Customer Company Name"
                value={document.customer_name_snapshot}
                onChange={(value) =>
                  updateDocument({ customer_name_snapshot: value })
                }
              />
              <TextField
                label="Address Line 1"
                value={document.address_line_1_snapshot}
                onChange={(value) =>
                  updateDocument({ address_line_1_snapshot: value })
                }
              />
              <TextField
                label="City"
                value={document.city_snapshot}
                onChange={(value) => updateDocument({ city_snapshot: value })}
              />
              <TextField
                label="Province"
                value={document.province_snapshot}
                onChange={(value) =>
                  updateDocument({ province_snapshot: value })
                }
              />
              <TextField
                label="Postal Code"
                value={document.postal_code_snapshot}
                onChange={(value) =>
                  updateDocument({ postal_code_snapshot: value })
                }
              />
              <TextField
                label="Attendee Name"
                value={document.attendee_name_snapshot}
                onChange={(value) =>
                  updateDocument({ attendee_name_snapshot: value })
                }
              />
              <TextField
                label="Attendee Email"
                type="email"
                value={document.attendee_email_snapshot}
                onChange={(value) =>
                  updateDocument({ attendee_email_snapshot: value })
                }
              />
            </div>
          </StepCard>
        ) : null}

        {activeStep === 2 ? (
          <StepCard
            description="Quotation number and revision come from the internal quotation and remain read-only."
            title="Quotation Details"
          >
            <div className="grid gap-5 md:grid-cols-3">
              <TextField
                required
                label="Quotation Date"
                type="date"
                value={document.quotation_date}
                onChange={(value) => updateDocument({ quotation_date: value })}
              />
              <ReadOnlyField
                label="Quotation Number"
                value={document.quotation_number_snapshot}
              />
              <ReadOnlyField
                label="Revision Number"
                value={String(document.revision_number_snapshot)}
              />
            </div>
          </StepCard>
        ) : null}

        {activeStep === 3 ? (
          <StepCard
            description="Each internal scope becomes one synchronized customer-facing line. Internal cost details remain private."
            title="Scope & Pricing"
          >
            <div className="space-y-5">
              <div className="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100 sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Pricing is synchronized from the internal quotation. Edit the
                  Quotation Form to change quantity or pricing.
                </p>
                {!readOnly ? (
                  <Button
                    nativeButton={false}
                    render={
                      <Link href={`/dashboard/quotations/${quotationId}/edit`} />
                    }
                    size="sm"
                    variant="outline"
                  >
                    Edit Quotation Form
                  </Button>
                ) : null}
              </div>
              {items.map((item, index) => (
                <section
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                  key={item.id ?? item.scope_id}
                >
                  <div>
                    <div>
                      <p className="text-xs font-medium uppercase text-zinc-500">
                        Scope {index + 1}
                      </p>
                      <h3 className="mt-1 font-semibold">
                        {item.scope_title_snapshot}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="text-xs font-medium">
                      Customer Description
                    </Label>
                    <div className="mt-2">
                      <RichTextEditor
                        readOnly={readOnly}
                        value={item.description_html}
                        onChange={(html, plainText) =>
                          updateItem(index, {
                            description_html: html,
                            description_text: plainText,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <ReadOnlyField
                      label="Qty."
                      value={String(item.quantity)}
                    />
                    <ReadOnlyField
                      label="Price Each"
                      value={money(item.price_each)}
                    />
                    <ReadOnlyField
                      label="Price Ext"
                      value={money(item.price_ext)}
                    />
                  </div>
                </section>
              ))}
              <div className="ml-auto grid w-full max-w-lg gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900">
                <PricingSummaryLine label="Scope Subtotal" value={document.subtotal} />
                <PricingSummaryLine label="Final Discount" value={-document.discount_amount} />
                {document.final_additional_charges_total > 0 ? (
                  <PricingSummaryLine label="Final Additional Charges" value={document.final_additional_charges_total} />
                ) : null}
                <PricingSummaryLine label="Grand Total Before Tax" value={document.grand_total_before_tax} />
                <PricingSummaryLine label={`${document.tax_name || "Tax"} (${document.tax_rate}%)`} value={document.tax_amount} />
                <div className="mt-1 border-t border-zinc-300 pt-2 dark:border-zinc-700">
                  <PricingSummaryLine strong label="Final Grand Total" value={document.total} />
                </div>
              </div>
            </div>
          </StepCard>
        ) : null}

        {activeStep === 4 ? (
          <StepCard
            description="Complete the commercial details shown below the quotation table."
            title="Commercial Terms"
          >
            <div className="space-y-5">
              <p className="rounded-md bg-zinc-50 p-4 text-sm leading-6 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                Thank you, for the opportunity to quote on your requirements,
                please call if you require further information.
              </p>
              <TextareaField
                label="Delivery"
                value={document.delivery_text}
                onChange={(value) => updateDocument({ delivery_text: value })}
              />
              <TextareaField
                label="Terms"
                value={document.terms_text}
                onChange={(value) => updateDocument({ terms_text: value })}
              />
              <TextareaField
                label="FOB"
                value={document.fob_text}
                onChange={(value) => updateDocument({ fob_text: value })}
              />
              <Separator />
              <p className="text-sm">
                Order Subject to{" "}
                <strong>{organization.company_name}</strong> Standard terms and
                conditions of sale.
              </p>
              <div>
                <p className="text-sm">Sincerely,</p>
                <p className="mt-3 font-semibold">
                  {document.prepared_by_name_snapshot || "-"}
                </p>
              </div>
            </div>
          </StepCard>
        ) : null}

        {activeStep === 5 ? (
          <div className="space-y-6">
            <StepCard
              description="Review the A4 customer document before generating an immutable PDF version."
              title="Preview & Generate PDF"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    Final total: {money(document.total)}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Terms and Conditions begin on a separate page.
                  </p>
                </div>
                <Button
                  className="rounded-md"
                  disabled={isGenerating || isSaving}
                  type="button"
                  onClick={() => void generatePdf()}
                >
                  <FileDownIcon className="size-4" />
                  {isGenerating ? "Generating..." : "Generate Final PDF"}
                </Button>
              </div>
            </StepCard>
            <div className="overflow-x-auto rounded-lg bg-zinc-200 p-4 dark:bg-zinc-900 sm:p-8">
              <CustomerQuotationPreview
                data={{
                  organization,
                  document: previewDocument,
                  items,
                }}
              />
            </div>
            {generatedDocuments.length > 0 ? (
              <StepCard
                description="Previously generated PDFs remain immutable and available through short-lived links."
                title="Generated Documents"
              >
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {generatedDocuments.map((generated) => {
                    const signedUrl = generated.signed_url;

                    return (
                      <div
                        className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        key={generated.id}
                      >
                        <div>
                          <p className="text-sm font-medium">
                            Revision {generated.revision_number ?? 0}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            {generated.generated_at
                              ? new Date(generated.generated_at).toLocaleString(
                                  "en-CA",
                                )
                              : "-"}{" "}
                            ·{" "}
                            {generated.generated_by_profile?.full_name ||
                              generated.generated_by_profile?.email ||
                              "Unknown"}
                          </p>
                        </div>
                        {signedUrl ? (
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
                            <ExternalLinkIcon className="size-4" />
                            View PDF
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </StepCard>
            ) : null}
          </div>
        ) : null}
        </fieldset>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:left-64">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Button
            className="rounded-md"
            disabled={activeStep === 0}
            type="button"
            variant="outline"
            onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!readOnly ? <Button
              className="hidden rounded-md sm:inline-flex"
              disabled={isSaving}
              type="button"
              variant="outline"
              onClick={() => void saveDraft()}
            >
              <SaveIcon className="size-4" />
              Save Draft
            </Button> : null}
            {activeStep < steps.length - 1 ? (
              <Button
                className="rounded-md"
                type="button"
                onClick={() =>
                  setActiveStep((step) => Math.min(steps.length - 1, step + 1))
                }
              >
                Next
                <ArrowRightIcon className="size-4" />
              </Button>
            ) : !readOnly ? (
              <Button
                className="rounded-md"
                disabled={isGenerating || isSaving}
                type="button"
                onClick={() => void generatePdf()}
              >
                <FileDownIcon className="size-4" />
                Generate PDF
              </Button>
            ) : null}
          </div>
        </div>
      </div>

    </div>
  );
}

function StepCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <Separator className="my-5" />
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label>
        {label}
        {required ? <span className="ml-1 text-red-500">*</span> : null}
      </Label>
      <Input
        className={cn(inputClass, "mt-2")}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        className="mt-2 min-h-24 rounded-md border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs text-zinc-500">{label}</Label>
      <div className="mt-2 min-h-10 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function PricingSummaryLine({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}
