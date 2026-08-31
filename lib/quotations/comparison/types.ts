export type ChangeType = "unchanged" | "added" | "removed" | "modified";

export type ComparisonQuotation = {
  id: string;
  quotationNumber: string | null;
  revisionNumber: number;
  status: string | null;
  expiryDate: string | null;
  customerNameFallback: string | null;
};

export type ComparisonCustomerDocument = {
  quotationNumber: string | null;
  revisionNumber: number;
  customerName: string | null;
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  attentionName: string | null;
  attentionEmail: string | null;
  quotationDate: string | null;
  delivery: string | null;
  terms: string | null;
  fob: string | null;
  preparedBy: string | null;
};

export type ComparisonScope = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  quantity: number;
  calculatedPriceEach: number;
  scopeTotal: number;
  discountType: string | null;
  discountValue: number;
  discountAmount: number;
};

export type ComparisonCustomerItem = {
  scopeId: string | null;
  title: string;
  sortOrder: number;
  descriptionText: string | null;
  estimationQuantity: number | null;
  quantity: number | null;
  priceEach: number | null;
  priceExt: number | null;
};

export type ComparisonPricing = {
  scopeSubtotal: number;
  finalDiscount: number;
  finalAdditionalCharges: number;
  grandTotalBeforeTax: number;
  taxName: string | null;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
};

export type ComparisonRevision = {
  quotation: ComparisonQuotation;
  hasCustomerDocument: boolean;
  customerDocument: ComparisonCustomerDocument | null;
  scopes: ComparisonScope[];
  customerItems: ComparisonCustomerItem[];
  pricing: ComparisonPricing;
};

export type ComparisonResponse = {
  revisionA: ComparisonRevision;
  revisionB: ComparisonRevision;
};

export type ScopeComparisonRow = {
  key: string;
  revisionA: ComparisonScope | null;
  revisionB: ComparisonScope | null;
  customerItemA: ComparisonCustomerItem | null;
  customerItemB: ComparisonCustomerItem | null;
  changeType: ChangeType;
};

