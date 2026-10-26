import { ToneBadge } from "@/components/ui/tone-badge";
import {
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONES,
  type QuoteStatus,
} from "@/features/quotes/status";

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: QuoteStatus;
  className?: string;
}) {
  return (
    <ToneBadge tone={QUOTE_STATUS_TONES[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </ToneBadge>
  );
}
