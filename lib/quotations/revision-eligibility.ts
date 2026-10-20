export const postAcceptanceRevisionJobStatuses = [
  "po_pending",
  "work_in_process",
] as const;

export function canCreatePostAcceptanceRevision(
  quotationStatus: string | null | undefined,
  jobStatus: string | null | undefined,
) {
  return (
    quotationStatus === "accepted" &&
    postAcceptanceRevisionJobStatuses.includes(
      jobStatus as (typeof postAcceptanceRevisionJobStatuses)[number],
    )
  );
}
