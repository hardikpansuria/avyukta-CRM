import { LoadingState } from "@/components/ui/loading-state";

export default function QuotationLoading() {
  return (
    <LoadingState
      description="Retrieving scopes, pricing, and revision history."
      message="Opening quotation..."
    />
  );
}
