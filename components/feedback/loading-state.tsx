import { Skeleton } from "@/components/ui/skeleton";

/** Chargement explicite : squelette de liste + libellé pour lecteurs d'écran. */
export function LoadingState({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-7 w-40" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
