"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Bouton d'envoi désactivé pendant l'envoi : évite les doubles soumissions
 * et indique clairement que l'enregistrement est en cours.
 */
export function SubmitButton({
  children,
  pendingLabel = "Envoi en cours…",
  disabled,
  pending: pendingOverride,
  ...props
}: React.ComponentProps<typeof Button> & {
  pendingLabel?: string;
  /** Envoi déclenché à la main (startTransition) : état fourni par l'appelant. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingOverride ?? status.pending;
  return (
    <Button
      type="submit"
      {...props}
      disabled={pending || disabled}
      aria-disabled={pending || disabled}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
