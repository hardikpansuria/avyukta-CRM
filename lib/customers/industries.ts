export const CUSTOMER_INDUSTRIES = [
  "Food & Beverage",
  "Dairy",
  "Bakery",
  "Brewery",
  "Pharmaceutical",
  "Chemical",
  "Packaging",
  "Manufacturing",
  "Engineering",
] as const;

export const OTHER_INDUSTRY_VALUE = "__other__";

export function isStandardIndustry(value: string) {
  return CUSTOMER_INDUSTRIES.some((industry) => industry === value);
}
