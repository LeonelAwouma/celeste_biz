"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import {
  convertQuoteToOrder,
  transitionQuote,
} from "@/features/quotes/actions";
import type { QuoteAction } from "@/features/quotes/status";

/** Changements d'état du devis ; acceptation, refus et annulation avec note. */
export function QuoteActions({
  quoteId,
  version,
  actions,
}: {
  quoteId: string;
  version: number;
  actions: QuoteAction[];
}) {
  const [state, action] = useActionState(transitionQuote, initialFormState);
  const [confirming, setConfirming] = useState<QuoteAction | null>(null);

  if (!actions.length) return null;

  const hidden = (to: string) => (
    <>
      <input type="hidden" name="quoteId" value={quoteId} />
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
          className="flex flex-col gap-3 rounded-xl border bg-card p-3"
        >
          {hidden(confirming.to)}
          <p className="font-medium">{confirming.label}</p>
          <TextareaField
            name="note"
            label={
              confirming.note === "required"
                ? "Motif de l'annulation"
                : confirming.to === "accepted"
                  ? "Comment le client a-t-il accepté ? (facultatif)"
                  : "Note (facultatif)"
            }
            hint={
              confirming.to === "accepted"
                ? "Ex. accord par téléphone, message WhatsApp du 12 novembre."
                : undefined
            }
            maxLength={500}
            required={confirming.note === "required"}
            errors={state.fieldErrors?.note}
          />
          {confirming.to === "accepted" ? (
            <p className="text-sm text-muted-foreground">
              L&apos;acceptation est enregistrée comme déclarée par vous, avec
              votre nom et la date.
            </p>
          ) : null}
          <div className="flex gap-2">
            <SubmitButton
              variant={confirming.kind === "danger" ? "destructive" : "default"}
              pendingLabel="…"
            >
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
            transition.note ? (
              <Button
                key={transition.to}
                type="button"
                variant={
                  transition.kind === "forward"
                    ? "default"
                    : transition.kind === "danger"
                      ? "ghost"
                      : "outline"
                }
                className={
                  transition.kind === "danger" ? "text-destructive" : undefined
                }
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
                >
                  {transition.label}
                </SubmitButton>
              </form>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Devis accepté → commande confirmée (date de remise facultative). */
export function ConvertQuoteForm({ quoteId }: { quoteId: string }) {
  const [state, action] = useActionState(convertQuoteToOrder, initialFormState);
  const [orderId] = useState(() => crypto.randomUUID());
  return (
    <form
      noValidate
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-card p-3"
    >
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="orderId" value={orderId} />
      <p className="font-medium">Transformer en commande</p>
      <p className="text-sm text-muted-foreground">
        Les lignes et les prix du devis sont repris tels quels dans une commande
        confirmée.
      </p>
      <FormMessage state={state} />
      <FormField
        name="dueDate"
        label="À remettre le (facultatif)"
        type="date"
        defaultValue={state.values?.dueDate}
        errors={state.fieldErrors?.dueDate}
      />
      <SubmitButton pendingLabel="Création…">Créer la commande</SubmitButton>
    </form>
  );
}
