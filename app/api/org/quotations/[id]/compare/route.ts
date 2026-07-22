import { NextResponse } from "next/server";

import { verifyOrgSession } from "@/lib/auth/verify-org-session";
import { getQuotationDetail } from "@/lib/quotations/api";
import type {
  ComparisonCustomerDocument,
  ComparisonCustomerItem,
  ComparisonRevision,
  ComparisonScope,
} from "@/lib/quotations/comparison/types";
import {
  getCustomerQuotationData,
  richTextToPlainText,
  sanitizeCustomerQuotationHtml,
  type CustomerQuotationData,
} from "@/lib/quotations/customer-quotation";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, unknown>;
type QuotationDetail = Awaited<ReturnType<typeof getQuotationDetail>>;

function text(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || null;
}

function number(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function comparisonDescription(html: unknown, plainText: unknown) {
  const sanitized = sanitizeCustomerQuotationHtml(html);
  const withBoundaries = sanitized
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/(p|li|h2|h3)>/gi, "\n");
  return (
    richTextToPlainText(withBoundaries)
      .replace(/\s*•\s*/g, "\n• ")
      .trim() || text(plainText)
  );
}

function customerDocument(
  data: CustomerQuotationData,
): ComparisonCustomerDocument | null {
  if (!data.exists) return null;
  const document = data.document;
  return {
    quotationNumber: text(document.quotation_number_snapshot),
    revisionNumber: number(document.revision_number_snapshot),
    customerName: text(document.customer_name_snapshot),
    addressLine1: text(document.address_line_1_snapshot),
    city: text(document.city_snapshot),
    province: text(document.province_snapshot),
    postalCode: text(document.postal_code_snapshot),
    attentionName: text(document.attendee_name_snapshot),
    attentionEmail: text(document.attendee_email_snapshot),
    quotationDate: text(document.quotation_date),
    delivery: text(document.delivery_text),
    terms: text(document.terms_text),
    fob: text(document.fob_text),
    preparedBy: text(document.prepared_by_name_snapshot),
  };
}

function comparisonScopes(detail: QuotationDetail): ComparisonScope[] {
  return ((detail.scopes ?? []) as Row[]).map((scope, index) => {
    const quantity = number(scope.quantity, 1) || 1;
    const scopeTotal = number(scope.scope_total_after_discount);
    return {
      id: String(scope.id),
      title: text(scope.scope_title) ?? `Scope of Work ${index + 1}`,
      description: text(scope.scope_description),
      sortOrder: number(scope.sort_order, index + 1),
      quantity,
      calculatedPriceEach: scopeTotal / quantity,
      scopeTotal,
      discountType: text(scope.discount_type),
      discountValue: number(scope.discount_value),
      discountAmount: number(scope.discount_amount),
    };
  });
}

function comparisonCustomerItems(
  data: CustomerQuotationData,
): ComparisonCustomerItem[] {
  if (!data.exists) return [];
  return data.items.map((item, index) => {
    return {
      scopeId: text(item.scope_id),
      title:
        text(item.scope_title_snapshot) ?? `Scope of Work ${index + 1}`,
      sortOrder: number(item.sort_order, index + 1),
      descriptionText: comparisonDescription(
        item.description_html,
        item.description_text,
      ),
      estimationQuantity:
        item.estimation_quantity === null || item.estimation_quantity === undefined
          ? null
          : number(item.estimation_quantity),
      quantity:
        item.quantity === null || item.quantity === undefined
          ? null
          : number(item.quantity),
      priceEach:
        item.price_each === null || item.price_each === undefined
          ? null
          : number(item.price_each),
      priceExt:
        item.price_ext === null || item.price_ext === undefined
          ? null
          : number(item.price_ext),
    };
  });
}

function comparisonRevision(
  detail: QuotationDetail,
  customerData: CustomerQuotationData,
): ComparisonRevision {
  const quotation = detail.quotation as Row;
  const customer = (quotation.customer ?? null) as Row | null;
  return {
    quotation: {
      id: String(quotation.id),
      quotationNumber: text(quotation.quotation_number),
      revisionNumber: number(quotation.revision_number),
      status: text(quotation.status),
      expiryDate: text(quotation.expiry_date),
      customerNameFallback: text(customer?.company_name),
    },
    hasCustomerDocument: customerData.exists,
    customerDocument: customerDocument(customerData),
    scopes: comparisonScopes(detail),
    customerItems: comparisonCustomerItems(customerData),
    pricing: {
      scopeSubtotal: number(quotation.scopes_subtotal),
      finalDiscount: number(quotation.final_discount_amount),
      finalAdditionalCharges: number(
        quotation.final_additional_charges_total,
      ),
      grandTotalBeforeTax: number(quotation.grand_total_before_tax),
      taxName: text(quotation.tax_name),
      taxRate: number(quotation.tax_rate),
      taxAmount: number(quotation.tax_amount),
      grandTotal: number(
        quotation.grand_total_after_tax ?? quotation.grand_total,
      ),
    },
  };
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/org/quotations/[id]/compare">,
) {
  const session = await verifyOrgSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const url = new URL(request.url);
  const revisionA = url.searchParams.get("revisionA") ?? id;
  const revisionB = url.searchParams.get("revisionB") ?? "";
  if (!revisionA || !revisionB || revisionA === revisionB) {
    return NextResponse.json(
      { error: "Select two different revisions" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: quotations, error } = await admin
    .from("quotations")
    .select("id,quotation_series_id")
    .eq("org_id", session.org_id)
    .in("id", [revisionA, revisionB]);
  if (error) {
    return NextResponse.json(
      { error: "Unable to validate revisions" },
      { status: 500 },
    );
  }
  if ((quotations ?? []).length !== 2) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }
  if (quotations![0].quotation_series_id !== quotations![1].quotation_series_id) {
    return NextResponse.json(
      { error: "Revisions must belong to the same quotation series" },
      { status: 400 },
    );
  }

  const [detailA, detailB, customerA, customerB] = await Promise.all([
    getQuotationDetail(admin, session.org_id, revisionA),
    getQuotationDetail(admin, session.org_id, revisionB),
    getCustomerQuotationData(admin, session.org_id, revisionA),
    getCustomerQuotationData(admin, session.org_id, revisionB),
  ]);
  if (
    detailA.error ||
    detailB.error ||
    customerA.error ||
    customerB.error ||
    !detailA.quotation ||
    !detailB.quotation ||
    !customerA.value ||
    !customerB.value
  ) {
    return NextResponse.json(
      { error: "Unable to load revision data" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    revisionA: comparisonRevision(detailA, customerA.value),
    revisionB: comparisonRevision(detailB, customerB.value),
  });
}
