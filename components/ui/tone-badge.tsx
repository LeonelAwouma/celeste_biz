import { cn } from "@/lib/utils";

export type Tone = "neutral" | "info" | "progress" | "success" | "danger";

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-accent-foreground",
  progress: "bg-warning text-warning-foreground",
  success: "bg-success text-success-foreground",
  danger: "bg-destructive/10 text-destructive",
};

/** Pastille d'état (devis, factures). */
export function ToneBadge({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
