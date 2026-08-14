import { NewInvoiceRequestForm } from "./new-invoice-request-form";

export default async function NewInvoiceRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const { jobId } = await searchParams;
  return <NewInvoiceRequestForm initialJobId={jobId ?? ""} />;
}
