"use client";

import { ErrorState } from "@/components/feedback/error-state";

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState onRetry={retry} code={error.digest} />;
}
