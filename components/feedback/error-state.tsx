import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

/** Message d'erreur utilisable : ce qui s'est passé et comment réessayer. */
export function ErrorState({
  title = "Un problème est survenu",
  description = "Vérifiez votre connexion Internet puis réessayez. Si le problème continue, contactez le support.",
  onRetry,
}: ErrorStateProps) {
  return (
    <section
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-card px-4 py-10 text-center"
    >
      <TriangleAlert aria-hidden="true" className="size-10 text-destructive" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="max-w-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button onClick={onRetry} className="mt-2">
          Réessayer
        </Button>
      ) : null}
    </section>
  );
}
