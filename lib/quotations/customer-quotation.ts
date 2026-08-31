import type { SupabaseClient } from "@supabase/supabase-js";
import sanitizeHtml from "sanitize-html";

import { isOrgScopedStoragePath } from "../supabase/storage-path";
import {
  isCustomerDocumentType,
  type CustomerDocumentType,
} from "./customer-document-type";

export type CustomerQuotationItemInput = {
  id?: string;
  scope_id?: string | null;
  sort_order?: number | string | null;
  scope_title_snapshot?: string | null;
  description_html?: string | null;
  description_text?: string | null;
  notes_html?: string | null;
  notes_text?: string | null;
  imported_scope_amount?: number | string | null;
  estimation_quantity?: number | string | null;
  quantity?: number | string | null;
};

export type CustomerQuotationDraftInput = {
  document_type?: CustomerDocumentType | null;
  quotation_date?: string | null;
  customer_name_snapshot?: string | null;
  address_line_1_snapshot?: string | null;
  city_snapshot?: string | null;
  province_snapshot?: string | null;
  postal_code_snapshot?: string | null;
  attendee_name_snapshot?: string | null;
  attendee_email_snapshot?: string | null;
  delivery_text?: string | null;
  terms_text?: string | null;
  fob_text?: string | null;
  items?: CustomerQuotationItemInput[];
};

type SourceContext = {
  quotation: Record<string, unknown>;
  organization: Record<string, unknown>;
  customer: Record<string, unknown>;
  address: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  preparedBy: Record<string, unknown> | null;
  scopes: Array<Record<string, unknown>>;
  noteSections: Array<Record<string, unknown>>;
};

export type CustomerQuotationData = {
  exists: boolean;
  document: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  organization: {
    branding_version_id: string | null;
    company_name: string;
    phone: string;
    fax: string;
    footer_text: string;
    terms_html: string;
    terms_text: string;
    logo_signed_url: string | null;
    logo_storage_path: string | null;
    has_logo: boolean;
    effective_from: string | null;
    effective_to: string | null;
  };
  source_scopes: Array<{
    id: unknown;
    scope_title: unknown;
    internal_scope_total: unknown;
    internal_scope_quantity: unknown;
  }>;
  pricing_summary: {
    subtotal: number | string | null;
    discount_amount: number | string | null;
    final_additional_charges_total: number | string | null;
    grand_total_before_tax: number | string | null;
    tax_name: string | null;
    tax_rate: number | string | null;
    tax_amount: number | string | null;
    total: number | string | null;
  };
};

const allowedRichTextTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
];

export function sanitizeCustomerQuotationHtml(value: unknown) {
  return sanitizeHtml(typeof value === "string" ? value : "", {
    allowedTags: allowedRichTextTags,
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
}

export function richTextToPlainText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function positiveNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function dateOnly(value: unknown) {
  const normalized = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

type BrandingRecord = {
  id: string | null;
  company_name: string;
  phone: string;
  fax: string;
  footer_text: string;
  terms_html: string;
  terms_text: string;
  logo_storage_path: string | null;
  effective_from: string | null;
  effective_to: string | null;
};

function fallbackBranding(organization: Record<string, unknown>): BrandingRecord {
  return {
    id: null,
    company_name:
      text(organization.quotation_company_name) || text(organization.name),
    phone: text(organization.quotation_phone),
    fax: text(organization.quotation_fax),
    footer_text: text(organization.quotation_footer_text),
    terms_html: sanitizeCustomerQuotationHtml(
      organization.quotation_terms_html,
    ),
    terms_text: text(organization.quotation_terms_text),
    logo_storage_path: text(organization.logo_storage_path) || null,
    effective_from: null,
    effective_to: null,
  };
}

async function effectiveBranding(
  admin: SupabaseClient,
  orgId: string,
  effectiveDate: string,
  organization: Record<string, unknown>,
) {
  const fallback = fallbackBranding(organization);
  const { data, error } = await admin
    .from("organization_quotation_branding_versions")
    .select(
      "id,company_name,phone,fax,footer_text,terms_html,terms_text,logo_storage_path,effective_from,effective_to",
    )
    .eq("org_id", orgId)
    .lte("effective_from", effectiveDate)
    .or(`effective_to.is.null,effective_to.gte.${effectiveDate}`)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { error };
  if (!data) return { value: fallback };

  return {
    value: {
      id: text(data.id) || null,
      company_name: text(data.company_name) || fallback.company_name,
      phone: text(data.phone),
      fax: text(data.fax),
      footer_text: text(data.footer_text),
      terms_html: sanitizeCustomerQuotationHtml(data.terms_html),
      terms_text: text(data.terms_text),
      logo_storage_path: text(data.logo_storage_path) || null,
      effective_from: dateOnly(data.effective_from),
      effective_to: dateOnly(data.effective_to),
    } satisfies BrandingRecord,
  };
}

function snapshottedBranding(
  document: Record<string, unknown>,
  fallback: BrandingRecord,
): BrandingRecord {
  if (!document.id || !text(document.organization_name_snapshot)) {
    return fallback;
  }

  return {
    id: text(document.branding_version_id) || fallback.id,
    company_name: text(document.organization_name_snapshot),
    phone: text(document.organization_phone_snapshot),
    fax: text(document.organization_fax_snapshot),
    footer_text: text(document.organization_footer_snapshot),
    terms_html: sanitizeCustomerQuotationHtml(
      document.organization_terms_html_snapshot,
    ),
    terms_text: text(document.organization_terms_text_snapshot),
    logo_storage_path:
      text(document.organization_logo_path_snapshot) || null,
    effective_from: fallback.effective_from,
    effective_to: fallback.effective_to,
  };
}

async function signedBrandingLogo(
  admin: SupabaseClient,
  orgId: string,
  storagePath: string | null,
) {
  if (!storagePath || !isOrgScopedStoragePath(storagePath, orgId)) return null;

  const { data, error } = await admin.storage
    .from("crm-assets")
    .createSignedUrl(storagePath, 10 * 60);

  return error ? null : data.signedUrl;
}

async function getSourceContext(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
): Promise<
  | { value: SourceContext; error?: never; notFound?: never }
  | { value?: never; error: unknown; notFound?: never }
  | { value?: never; error?: never; notFound: true }
> {
  const { data: quotation, error: quotationError } = await admin
    .from("quotations")
    .select("*")
    .eq("id", quotationId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (quotationError) return { error: quotationError };
  if (!quotation) return { notFound: true };

  const customerId = quotation.customer_id as string;
  const preparedById = quotation.prepared_by as string | null;
  const [
    organizationResult,
    customerResult,
    addressesResult,
    contactsResult,
    preparedByResult,
    scopesResult,
    notesResult,
  ] = await Promise.all([
    admin
      .from("organizations")
      .select(
        "id,name,logo_storage_path,quotation_company_name,quotation_phone,quotation_fax,quotation_footer_text,quotation_terms_html,quotation_terms_text",
      )
      .eq("id", orgId)
      .maybeSingle(),
    admin
      .from("customers")
      .select("id,company_name")
      .eq("id", customerId)
      .eq("org_id", orgId)
      .neq("record_status", "deleted")
      .maybeSingle(),
    admin
      .from("customer_addresses")
      .select(
        "id,address_type,address_line_1,city,province_state,postal_code,same_as_head_office",
      )
      .eq("org_id", orgId)
      .eq("customer_id", customerId)
      .neq("status", "deleted"),
    admin
      .from("quotation_contacts")
      .select(
        "id,contact_name_snapshot,email_snapshot,phone_snapshot,sort_order",
      )
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .limit(1),
    preparedById
      ? admin
          .from("profiles")
          .select("id,full_name,email")
          .eq("id", preparedById)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin
      .from("quotation_scopes")
      .select("id,scope_title,scope_total_after_discount,quantity,sort_order")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true }),
    admin
      .from("quotation_note_sections")
      .select("section_type,body_text,visible_to_customer")
      .eq("org_id", orgId)
      .eq("quotation_id", quotationId),
  ]);

  for (const result of [
    organizationResult,
    customerResult,
    addressesResult,
    contactsResult,
    preparedByResult,
    scopesResult,
    notesResult,
  ]) {
    if (result.error) return { error: result.error };
  }

  if (!organizationResult.data || !customerResult.data) {
    return { notFound: true };
  }

  const addresses = (addressesResult.data ?? []) as Array<
    Record<string, unknown>
  >;
  const billing = addresses.find(
    (address) => address.address_type === "billing",
  );
  const headOffice = addresses.find(
    (address) => address.address_type === "head_office",
  );
  const address =
    billing && billing.same_as_head_office !== true ? billing : headOffice ?? billing;
  return {
    value: {
      quotation,
      organization: organizationResult.data,
      customer: customerResult.data,
      address: address ?? null,
      contact: contactsResult.data?.[0] ?? null,
      preparedBy: preparedByResult.data,
      scopes: (scopesResult.data ?? []) as Array<Record<string, unknown>>,
      noteSections: (notesResult.data ?? []) as Array<Record<string, unknown>>,
    },
  };
}

function defaultTerms(source: SourceContext) {
  const paymentTerms = source.noteSections.find(
    (section) =>
      section.section_type === "payment_terms" &&
      section.visible_to_customer !== false,
  );
  return text(paymentTerms?.body_text);
}

function defaultDocument(source: SourceContext) {
  const subtotal = roundMoney(
    source.scopes.reduce(
      (sum, scope) => sum + pricingFromScope(scope).price_ext,
      0,
    ),
  );
  return {
    document_type: null,
    document_status: "draft",
    quotation_date:
      dateOnly(source.quotation.quote_date) ??
      new Date().toISOString().slice(0, 10),
    quotation_number_snapshot: text(source.quotation.quotation_number),
    revision_number_snapshot: Number(source.quotation.revision_number ?? 0),
    customer_name_snapshot: text(source.customer.company_name),
    address_line_1_snapshot: text(source.address?.address_line_1),
    city_snapshot: text(source.address?.city),
    province_snapshot: text(source.address?.province_state),
    postal_code_snapshot: text(source.address?.postal_code),
    attendee_name_snapshot: text(source.contact?.contact_name_snapshot),
    attendee_email_snapshot: text(source.contact?.email_snapshot),
    delivery_text: "",
    terms_text: defaultTerms(source),
    fob_text: "",
    prepared_by_id: text(source.quotation.prepared_by) || null,
    prepared_by_name_snapshot:
      text(source.preparedBy?.full_name) ||
      text(source.preparedBy?.email) ||
      "",
    subtotal,
    discount_amount: Number(source.quotation.final_discount_amount ?? 0),
    tax_name_snapshot: source.quotation.tax_name ?? null,
    tax_rate_snapshot: Number(source.quotation.tax_rate ?? 0),
    tax_amount: Number(source.quotation.tax_amount ?? 0),
    total: Number(source.quotation.grand_total_after_tax ?? 0),
    pricing_synced_at: null,
    generated_pdf_storage_path: null,
    generated_at: null,
  };
}

function pricingFromScope(scope: Record<string, unknown>) {
  const importedScopeAmount = roundMoney(
    nonNegativeNumber(scope.scope_total_after_discount),
  );
  const quantity = positiveNumber(scope.quantity, 1);
  const priceEach = roundMoney(importedScopeAmount / quantity);

  return {
    imported_scope_amount: importedScopeAmount,
    estimation_quantity: quantity,
    quantity,
    price_each: priceEach,
    price_ext: roundMoney(priceEach * quantity),
  };
}

function defaultItems(source: SourceContext) {
  return source.scopes.map((scope, index) => {
    const title = text(scope.scope_title) || `Scope of Work ${index + 1}`;
    return {
      scope_id: text(scope.id),
      sort_order: index + 1,
      scope_title_snapshot: title,
      description_html: `<p>${escapeHtml(title)}</p>`,
      description_text: title,
      notes_html: null,
      notes_text: null,
      ...pricingFromScope(scope),
    };
  });
}

function reconcileItems(
  source: SourceContext,
  savedItems: Array<Record<string, unknown>>,
) {
  const savedByScopeId = new Map(
    savedItems.map((item) => [text(item.scope_id), item]),
  );

  return defaultItems(source).map((defaultItem) => {
    const savedItem = savedByScopeId.get(defaultItem.scope_id);

    return savedItem
      ? {
          ...savedItem,
          scope_id: defaultItem.scope_id,
          sort_order: defaultItem.sort_order,
          scope_title_snapshot: defaultItem.scope_title_snapshot,
          imported_scope_amount: defaultItem.imported_scope_amount,
          estimation_quantity: defaultItem.estimation_quantity,
          quantity: defaultItem.quantity,
          price_each: defaultItem.price_each,
          price_ext: defaultItem.price_ext,
        }
      : defaultItem;
  });
}

export async function getCustomerQuotationData(
  admin: SupabaseClient,
  orgId: string,
  quotationId: string,
  options?: { brandingDate?: string | null },
): Promise<{
  value?: CustomerQuotationData;
  error?: unknown;
  notFound?: boolean;
}> {
  const sourceResult = await getSourceContext(admin, orgId, quotationId);

  if (sourceResult.error) return { error: sourceResult.error };
  if (sourceResult.notFound || !sourceResult.value) return { notFound: true };

  const source = sourceResult.value;
  const sourceSubtotal = roundMoney(
    source.scopes.reduce(
      (sum, scope) => sum + pricingFromScope(scope).price_ext,
      0,
    ),
  );
  const { data: document, error: documentError } = await admin
    .from("quotation_customer_documents")
    .select("*")
    .eq("org_id", orgId)
    .eq("quotation_id", quotationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (documentError) return { error: documentError };

  const brandingDate =
    dateOnly(options?.brandingDate) ??
    dateOnly(document?.quotation_date) ??
    dateOnly(source.quotation.quote_date) ??
    new Date().toISOString().slice(0, 10);
  const brandingResult = await effectiveBranding(
    admin,
    orgId,
    brandingDate,
    source.organization,
  );
  if (brandingResult.error || !brandingResult.value) {
    return { error: brandingResult.error };
  }
  const branding = snapshottedBranding(
    (document ?? {}) as Record<string, unknown>,
    brandingResult.value,
  );
  const logoSignedUrl = await signedBrandingLogo(
    admin,
    orgId,
    branding.logo_storage_path,
  );

  const { data: savedItems, error: itemsError } = document
    ? await admin
        .from("quotation_customer_document_items")
        .select("*")
        .eq("org_id", orgId)
        .eq("quotation_id", quotationId)
        .eq("customer_document_id", document.id)
        .order("sort_order", { ascending: true })
    : { data: null, error: null };

  if (itemsError) return { error: itemsError };

  return {
    value: {
      exists: Boolean(document),
      document: document ?? defaultDocument(source),
      items:
        source.quotation.is_locked === true && document
          ? ((savedItems ?? []) as Array<Record<string, unknown>>)
          : reconcileItems(
              source,
              (savedItems ?? []) as Array<Record<string, unknown>>,
            ),
      organization: {
        branding_version_id: branding.id,
        company_name: branding.company_name,
        phone: branding.phone,
        fax: branding.fax,
        footer_text: branding.footer_text,
        terms_html: branding.terms_html,
        terms_text: branding.terms_text,
        logo_signed_url: logoSignedUrl,
        logo_storage_path: branding.logo_storage_path,
        has_logo: Boolean(branding.logo_storage_path),
        effective_from: branding.effective_from,
        effective_to: branding.effective_to,
      },
      source_scopes: source.scopes.map((scope) => ({
        id: scope.id,
        scope_title: scope.scope_title,
        internal_scope_total: scope.scope_total_after_discount,
        internal_scope_quantity: scope.quantity,
      })),
      pricing_summary: {
        subtotal: Number(document?.subtotal ?? sourceSubtotal),
        discount_amount: Number(
          document?.discount_amount ?? source.quotation.final_discount_amount ?? 0,
        ),
        final_additional_charges_total: Number(
          source.quotation.final_additional_charges_total ?? 0,
        ),
        grand_total_before_tax: Number(
          source.quotation.grand_total_before_tax ?? 0,
        ),
        tax_name:
          text(document?.tax_name_snapshot ?? source.quotation.tax_name) || null,
        tax_rate: Number(
          document?.tax_rate_snapshot ?? source.quotation.tax_rate ?? 0,
        ),
        tax_amount: Number(
          document?.tax_amount ?? source.quotation.tax_amount ?? 0,
        ),
        total: Number(
          document?.total ?? source.quotation.grand_total_after_tax ?? 0,
        ),
      },
    },
  };
}

export function normalizeCustomerQuotationDraft(
  input: CustomerQuotationDraftInput,
  fallbackDocument: Record<string, unknown>,
) {
  const documentType = isCustomerDocumentType(input.document_type)
    ? input.document_type
    : isCustomerDocumentType(fallbackDocument.document_type)
      ? fallbackDocument.document_type
      : null;

  if (!documentType) {
    return { error: "Document type is required" };
  }

  const quotationDate =
    dateOnly(input.quotation_date) ??
    dateOnly(fallbackDocument.quotation_date);

  if (!quotationDate) {
    return { error: "Quotation date is required" };
  }

  if (!Array.isArray(input.items)) {
    return { error: "Customer quotation items are required" };
  }

  const items = input.items.map((item, index) => {
    const descriptionHtml = sanitizeCustomerQuotationHtml(item.description_html);
    const notesHtml = sanitizeCustomerQuotationHtml(item.notes_html);
    const notesText = richTextToPlainText(notesHtml);
    return {
      id: text(item.id) || undefined,
      scope_id: text(item.scope_id) || null,
      sort_order: index + 1,
      scope_title_snapshot:
        text(item.scope_title_snapshot) || `Scope of Work ${index + 1}`,
      description_html: descriptionHtml,
      description_text:
        richTextToPlainText(descriptionHtml) || text(item.description_text) || null,
      notes_html: notesText ? notesHtml : null,
      notes_text: notesText || null,
    };
  });

  return {
    value: {
      document_type: documentType,
      quotation_date: quotationDate,
      customer_name_snapshot:
        text(input.customer_name_snapshot) ||
        text(fallbackDocument.customer_name_snapshot),
      address_line_1_snapshot: text(input.address_line_1_snapshot),
      city_snapshot: text(input.city_snapshot),
      province_snapshot: text(input.province_snapshot),
      postal_code_snapshot: text(input.postal_code_snapshot),
      attendee_name_snapshot: text(input.attendee_name_snapshot),
      attendee_email_snapshot: text(input.attendee_email_snapshot),
      delivery_text: text(input.delivery_text),
      terms_text: text(input.terms_text),
      fob_text: text(input.fob_text),
      items,
    },
  };
}
