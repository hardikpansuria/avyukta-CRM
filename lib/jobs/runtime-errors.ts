type DatabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const workCompletionDraftMessages = [
  "Completion Date is required",
  "Completion Date cannot be in the future",
  "Invalid completion status",
  "Outstanding Items are required for this completion status",
  "At least one Technician is required",
  "Job not found",
  "Only a Work in Progress job can be completed",
  "One or more selected Technicians are invalid or inactive",
  "The Work Order has no assigned quotation scope",
];

export function workCompletionDraftErrorMessage(message: string | undefined) {
  return (
    workCompletionDraftMessages.find((value) => message?.includes(value)) ??
    "Unable to prepare job completion"
  );
}

export function isDuplicatePurchaseOrderNumberError(
  error: DatabaseError | null | undefined,
) {
  if (error?.code !== "23505") return false;
  const description = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ");
  return (
    description.includes(
      "job_purchase_orders_org_id_customer_id_po_number_key",
    ) || description.includes("(org_id, customer_id, po_number)")
  );
}
