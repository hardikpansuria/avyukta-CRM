export type AllocationAmount = {
  purchase_order_id: string;
  total_po_amount: number | string | null;
};

export function activeAllocationTotal(allocations: AllocationAmount[]) {
  return Math.round(
    allocations.reduce(
      (sum, allocation) => sum + Number(allocation.total_po_amount ?? 0),
      0,
    ) * 100,
  ) / 100;
}

export function resolveActiveAllocation<T extends AllocationAmount>(
  allocations: T[],
  requestedPurchaseOrderId: string,
) {
  if (requestedPurchaseOrderId) {
    return allocations.find(
      (allocation) => allocation.purchase_order_id === requestedPurchaseOrderId,
    ) ?? null;
  }
  return allocations.length === 1 ? allocations[0] : null;
}

export function calculateChangeOrderTotals(
  items: Array<{ quantityDelta: number; unitPrice: number }>,
  taxRate: number,
) {
  const subtotal = Math.round(
    items.reduce(
      (sum, item) => sum + item.quantityDelta * item.unitPrice,
      0,
    ) * 100,
  ) / 100;
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  return {
    subtotal,
    taxAmount,
    total: Math.round((subtotal + taxAmount) * 100) / 100,
  };
}

export function isInvoiceEligibleJobStatus(status: string) {
  return status === "work_in_process" || status === "on_hold" || status === "work_completed";
}
