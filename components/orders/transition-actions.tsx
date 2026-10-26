"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import { transitionOrder } from "@/features/orders/actions";
import type { TransitionAction } from "@/features/orders/status";

/** Boutons de changement d'état ; l'annulation demande un motif. */
export function TransitionActions({
  orderId,
  version,
  actions,
  blockedClose,
}: {
  orderId: string;
  version: number;
  actions: TransitionAction[];
  /** Message si la clôture est impossible (solde restant). */
  blockedClose?: string;
}) {
  const [state, action] = useActionState(transitionOrder, initialFormState);
  const [confirming, setConfirming] = useState<TransitionAction | null>(null);

  if (!actions.length) return null;

  const hidden = (to: string) => (
    <>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="to" value={to} />
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <FormMessage state={state} />
      {confirming ? (
        <form
          noValidate
          action={action}
          className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-card p-3"
        >
          {hidden(confirming.to)}
          <p className="font-medium">{confirming.label}</p>
          <TextareaField
            name="reason"
            label={
              confirming.to === "cancelled"
                ? "Motif de l'annulation"
                : "Motif (facultatif)"
            }
            maxLength={500}
            required={confirming.to === "cancelled"}
            errors={state.fieldErrors?.reason}
          />
          <p className="text-sm text-muted-foreground">
            Les encaissements déjà enregistrés restent visibles. Un
            remboursement éventuel se gère à part.
          </p>
          <div className="flex gap-2">
            <SubmitButton variant="destructive" pendingLabel="…">
              Confirmer
            </SubmitButton>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(null)}
            >
              Retour
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map((transition) =>
            transition.kind === "danger" ? (
              <Button
                key={transition.to}
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirming(transition)}
              >
                {transition.label}
              </Button>
            ) : (
              <form key={transition.to} action={action}>
                {hidden(transition.to)}
                <SubmitButton
                  className="w-full"
                  variant={
                    transition.kind === "forward" ? "default" : "outline"
                  }
                  pendingLabel="Mise à jour…"
                  disabled={transition.to === "closed" && Boolean(blockedClose)}
                >
                  {transition.label}
                </SubmitButton>
                {transition.to === "closed" && blockedClose ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {blockedClose}
                  </p>
                ) : null}
              </form>
            ),
          )}
        </div>
      )}
    </div>
  );
}
