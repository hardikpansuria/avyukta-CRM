import { LoadingState } from "@/components/ui/loading-state";

export default function DashboardLoading() {
  return (
    <LoadingState
      description="Preparing your secure workspace."
      message="Loading dashboard..."
    />
  );
}
