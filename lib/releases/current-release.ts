export const currentRelease = {
  version: "1.0.1",
  href: "/release-notes/v1.0.1",
  publishedAt: "2026-10-21T23:45:52-06:00",
  publishedLabel: "October 21, 2026 at 11:45 PM CST",
  changes: [
    {
      title: "Purchase order corrections",
      description:
        "Authorized users can correct the PO number, amount, remarks, received date, and supporting document while keeping the same job and history.",
    },
    {
      title: "Revisions for active jobs",
      description:
        "A quotation can be revised after acceptance for an eligible active job, with a clear review of the changed scope and total before approval.",
    },
    {
      title: "Faster quotation PDF generation",
      description:
        "Customer quotation PDF preparation performs independent work in parallel and now shows saving, generating, and finalizing progress.",
    },
    {
      title: "Clearer quotation status",
      description:
        "The quotation status control now shows the current Draft, Sent, or Accepted status before any change is selected.",
    },
  ],
} as const;
