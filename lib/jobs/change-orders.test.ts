import { describe, expect, it } from "vitest";

import {
  activeAllocationTotal,
  calculateChangeOrderTotals,
  isInvoiceEligibleJobStatus,
  resolveActiveAllocation,
} from "./change-orders";

describe("change order and active PO calculations", () => {
  it("shows baseline plus supplemental PO value without reading an inactive PO", () => {
    const active = [
      { purchase_order_id: "baseline", total_po_amount: "700000.00" },
      { purchase_order_id: "supplement", total_po_amount: "25000.00" },
    ];
    expect(activeAllocationTotal(active)).toBe(725000);
  });

  it("requires an explicit PO selection when a job has multiple active POs", () => {
    const active = [
      { purchase_order_id: "baseline", total_po_amount: 700000 },
      { purchase_order_id: "supplement", total_po_amount: 25000 },
    ];
    expect(resolveActiveAllocation(active, "")).toBeNull();
    expect(resolveActiveAllocation(active, "supplement")?.purchase_order_id).toBe("supplement");
  });

  it("calculates two additional tanks and Ontario HST exactly", () => {
    expect(calculateChangeOrderTotals([
      { quantityDelta: 2, unitPrice: 1000 },
    ], 13)).toEqual({ subtotal: 2000, taxAmount: 260, total: 2260 });
  });

  it("keeps billing available while work is on hold but blocks stopped jobs", () => {
    expect(isInvoiceEligibleJobStatus("work_in_process")).toBe(true);
    expect(isInvoiceEligibleJobStatus("work_completed")).toBe(true);
    expect(isInvoiceEligibleJobStatus("on_hold")).toBe(true);
    expect(isInvoiceEligibleJobStatus("cancelled")).toBe(false);
    expect(isInvoiceEligibleJobStatus("terminated")).toBe(false);
  });
});
