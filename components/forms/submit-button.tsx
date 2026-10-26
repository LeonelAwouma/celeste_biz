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
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
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
