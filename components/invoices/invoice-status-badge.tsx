import { ToneBadge } from "@/components/ui/tone-badge";
import {
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/features/invoices/schemas";

const TONES = {
  draft: "progress",
  issued: "success",
  discarded: "neutral",
} as const;

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <ToneBadge tone={TONES[status]} className={className}>
      {INVOICE_STATUS_LABELS[status]}
    </ToneBadge>
  );
}
