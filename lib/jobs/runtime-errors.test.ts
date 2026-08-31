import { describe, expect, it } from "vitest";

import {
  isDuplicatePurchaseOrderNumberError,
  workCompletionDraftErrorMessage,
} from "./runtime-errors";

describe("workCompletionDraftErrorMessage", () => {
  it("returns the readable missing-scope validation", () => {
    expect(
      workCompletionDraftErrorMessage(
        "The Work Order has no assigned quotation scope",
      ),
    ).toBe("The Work Order has no assigned quotation scope");
  });

  it("does not expose an unexpected database error", () => {
    expect(workCompletionDraftErrorMessage("internal query details")).toBe(
      "Unable to prepare job completion",
    );
  });
});

describe("isDuplicatePurchaseOrderNumberError", () => {
  it("recognizes the PO-number unique constraint", () => {
    expect(
      isDuplicatePurchaseOrderNumberError({
        code: "23505",
        message:
          'duplicate key value violates unique constraint "job_purchase_orders_org_id_customer_id_po_number_key"',
      }),
    ).toBe(true);
  });

  it("does not misclassify another unique constraint", () => {
    expect(
      isDuplicatePurchaseOrderNumberError({
        code: "23505",
        message: "duplicate allocation",
      }),
    ).toBe(false);
  });
});
