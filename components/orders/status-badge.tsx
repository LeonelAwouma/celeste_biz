import { STATUS_TONES, statusLabel } from "@/features/orders/status";
import type {
  OrderState,
  ProfessionTemplate,
} from "@/features/professions/schema";
import { TONE_CLASSES } from "@/components/ui/tone-badge";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  template,
  className,
}: {
  status: OrderState;
  template?: ProfessionTemplate;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[STATUS_TONES[status]],
        className,
      )}
    >
      {statusLabel(status, template)}
    </span>
  );
}
