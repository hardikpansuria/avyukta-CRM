export const DEFAULT_QUOTATION_INTRO_TEXT =
  "Thank you, for the opportunity to quote on your requirements, please call if you require further information.";

export function defaultQuotationOrderTermsText(companyName: string) {
  return `Order Subject to ${companyName || "Organization"} Standard terms and conditions of sale.`;
}
