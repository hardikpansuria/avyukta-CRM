export const customerDocumentTypes = ["quotation", "work_order"] as const;

export type CustomerDocumentType = (typeof customerDocumentTypes)[number];

export function isCustomerDocumentType(
  value: unknown,
): value is CustomerDocumentType {
  return customerDocumentTypes.includes(value as CustomerDocumentType);
}

export function customerDocumentLabels(type: CustomerDocumentType) {
  return type === "work_order"
    ? {
        name: "Work Order",
        title: "Work Order",
        uppercaseTitle: "WORK ORDER",
        numberLabel: "Work Order",
      }
    : {
        name: "Customer Quotation",
        title: "Quotation",
        uppercaseTitle: "QUOTATION",
        numberLabel: "Quotation",
      };
}
