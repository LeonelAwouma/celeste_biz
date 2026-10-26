import { STATUS_TONES, statusLabel } from "@/features/orders/status";
import type {
  OrderState,
  ProfessionTemplate,
} from "@/features/professions/schema";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-accent-foreground",
  progress: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  danger: "bg-destructive/10 text-destructive",
} as const;

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
