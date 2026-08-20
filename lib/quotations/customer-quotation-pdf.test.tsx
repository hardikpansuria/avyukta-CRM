import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  renderCustomerQuotationPdf,
  type CustomerQuotationPdfData,
} from "./customer-quotation-pdf";

const sample: CustomerQuotationPdfData = {
  organization: {
    company_name: "PRO-TECH STAINLESS AND SERVICES LTD.",
    phone: "306-555-0100",
    fax: "306-555-0101",
    footer_text: "PRO-TECH STAINLESS AND SERVICES LTD. | Regina, SK",
    terms_html:
      "<h2>1. Acceptance</h2><p>Acceptance must be provided in writing.</p>",
  },
  document: {
    document_type: "work_order",
    quotation_date: "2026-08-19",
    quotation_number_snapshot: "QT-2026-001",
    revision_number_snapshot: 0,
    customer_name_snapshot: "Example Customer Ltd.",
    address_line_1_snapshot: "123 Industrial Road",
    city_snapshot: "Regina",
    province_snapshot: "SK",
    postal_code_snapshot: "S4P 3X1",
    attendee_name_snapshot: "Morgan Customer",
    attendee_email_snapshot: "morgan@example.com",
    delivery_text: "Four weeks from approval.",
    terms_text: "Net 30",
    fob_text: "Regina, Saskatchewan",
    prepared_by_name_snapshot: "Jordan Sales",
    subtotal: 1_000,
    discount_amount: 0,
    final_additional_charges_total: 0,
    grand_total_before_tax: 1_000,
    tax_name: "GST",
    tax_rate: 5,
    tax_amount: 50,
    total: 1_050,
  },
  items: [
    {
      id: "scope-1",
      scope_title_snapshot: "Fabrication",
      description_html: "<p>Fabricate stainless steel assembly.</p>",
      quantity: 1,
      price_each: 1_000,
      price_ext: 1_000,
    },
  ],
};

describe("Customer document PDF", () => {
  it("renders Work Order through the shared customer quotation template", async () => {
    const pdf = await renderCustomerQuotationPdf(sample);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);

    const samplePath = process.env.CUSTOMER_DOCUMENT_SAMPLE_PATH;
    if (samplePath) writeFileSync(samplePath, pdf);
  });
});
