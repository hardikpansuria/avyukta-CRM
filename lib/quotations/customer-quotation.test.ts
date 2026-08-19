import { describe, expect, it } from "vitest";

import { normalizeCustomerQuotationDraft } from "./customer-quotation";

const fallbackDocument = {
  quotation_date: "2026-08-18",
  customer_name_snapshot: "Example Customer",
};

describe("normalizeCustomerQuotationDraft", () => {
  it("preserves supported scope-note formatting and strips unsafe markup", () => {
    const result = normalizeCustomerQuotationDraft(
      {
        quotation_date: "2026-08-18",
        items: [
          {
            scope_id: "scope-1",
            scope_title_snapshot: "Fabrication",
            description_html: "<p>Fabricate tank</p>",
            notes_html:
              '<p onclick="alert(1)"><strong>Important</strong> <u style="color:red">note</u></p><ul><li>First item</li></ul>',
          },
        ],
      },
      fallbackDocument,
    );

    expect(result.error).toBeUndefined();
    expect(result.value?.items[0]).toMatchObject({
      notes_html:
        '<p><strong>Important</strong> <u>note</u></p><ul><li>First item</li></ul>',
      notes_text: "Important noteFirst item",
    });
  });

  it("stores visually empty notes as null so they are not rendered", () => {
    const result = normalizeCustomerQuotationDraft(
      {
        quotation_date: "2026-08-18",
        items: [
          {
            scope_id: "scope-1",
            scope_title_snapshot: "Fabrication",
            description_html: "<p>Fabricate tank</p>",
            notes_html: "<p><br></p>",
          },
        ],
      },
      fallbackDocument,
    );

    expect(result.value?.items[0]).toMatchObject({
      notes_html: null,
      notes_text: null,
    });
  });
});
