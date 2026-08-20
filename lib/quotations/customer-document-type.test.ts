import { describe, expect, it } from "vitest";

import {
  customerDocumentLabels,
  isCustomerDocumentType,
} from "./customer-document-type";

describe("customer document labels", () => {
  it("uses quotation terminology by default", () => {
    expect(customerDocumentLabels("quotation")).toMatchObject({
      name: "Customer Quotation",
      uppercaseTitle: "QUOTATION",
      numberLabel: "Quotation",
    });
  });

  it("changes only the customer-facing Work Order terminology", () => {
    expect(customerDocumentLabels("work_order")).toMatchObject({
      name: "Work Order",
      uppercaseTitle: "WORK ORDER",
      numberLabel: "Work Order",
    });
  });

  it("rejects unsupported document types", () => {
    expect(isCustomerDocumentType("invoice")).toBe(false);
  });
});
