import { LoadingState } from "@/components/ui/loading-state";

export default function QuotationsLoading() {
  return (
    <LoadingState
      description="Retrieving the latest quotation information."
      message="Loading quotations..."
    />
  );
}
