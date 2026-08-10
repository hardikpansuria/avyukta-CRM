const quotationStatusTransitions: Record<string, readonly string[]> = {
  draft: ["sent"],
  sent: ["accepted"],
};

export function allowedNextQuotationStatuses(
  currentStatus: string | null | undefined,
) {
  return quotationStatusTransitions[currentStatus ?? ""] ?? [];
}

export function canTransitionQuotationStatus(
  currentStatus: string | null | undefined,
  nextStatus: string,
) {
  return allowedNextQuotationStatuses(currentStatus).includes(nextStatus);
}
