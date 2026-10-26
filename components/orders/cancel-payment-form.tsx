"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import { cancelPayment } from "@/features/orders/actions";

export function CancelPaymentForm({
  paymentId,
  orderId,
}: {
  paymentId: string;
  orderId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelPayment, initialFormState);

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        Annuler cet encaissement
      </Button>
    );
  }
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <FormField
        name="reason"
        label="Motif de l'annulation"
        maxLength={500}
        errors={state.fieldErrors?.reason}
      />
      <div className="flex gap-2">
        <SubmitButton variant="destructive" size="sm" pendingLabel="…">
          Confirmer l&apos;annulation
        </SubmitButton>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(false)}
        >
          Retour
        </Button>
      </div>
    </form>
  );
}
