"use client";

import { ErrorState } from "@/components/feedback/error-state";

export default function DashboardError({ retry }: { retry: () => void }) {
  return <ErrorState onRetry={retry} />;
}
