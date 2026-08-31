import { NewInvoiceForm } from "./new-invoice-form";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string; requestId?: string }>;
}) {
  const { jobId, requestId } = await searchParams;
  return (
    <NewInvoiceForm
      initialJobId={jobId ?? ""}
      invoiceRequestId={requestId ?? ""}
    />
  );
}
