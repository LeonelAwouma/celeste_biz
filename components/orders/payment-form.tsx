"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState, type FormState } from "@/features/auth/schemas";
import { recordPayment } from "@/features/orders/actions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/features/orders/status";
import { toInputAmount } from "@/lib/monetary/xaf";

/** Encaissement manuel : statut « déclaré », jamais « vérifié ». */
export function PaymentForm({
  orderId,
  balance,
  today,
}: {
  orderId: string;
  balance: string;
  today: string;
}) {
  // Nouvel identifiant après chaque succès ; stable pendant une saisie.
  const [paymentId, setPaymentId] = useState(() => crypto.randomUUID());
  const [state, action] = useActionState(
    async (previous: FormState, formData: FormData) => {
      const result = await recordPayment(previous, formData);
      if (result.status === "success") setPaymentId(crypto.randomUUID());
      return result;
    },
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={action} className="flex flex-col gap-3" key={paymentId}>
      <input type="hidden" name="id" value={paymentId} />
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <div className="grid grid-cols-2 gap-3">
        <FormField
          name="amount"
          label="Montant (FCFA)"
          inputMode="decimal"
          defaultValue={values.amount ?? toInputAmount(balance)}
          errors={state.fieldErrors?.amount}
        />
        <SelectField
          name="method"
          label="Moyen"
          defaultValue={values.method ?? "cash"}
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: PAYMENT_METHOD_LABELS[method],
          }))}
          errors={state.fieldErrors?.method}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField
          name="paidOn"
          label="Date"
          type="date"
          max={today}
          defaultValue={values.paidOn ?? today}
          errors={state.fieldErrors?.paidOn}
        />
        <FormField
          name="reference"
          label="Référence (facultatif)"
          defaultValue={values.reference}
          errors={state.fieldErrors?.reference}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Enregistré comme déclaré par vous : Céleste Biz ne vérifie pas ce
        paiement auprès de l&apos;opérateur.
      </p>
      <SubmitButton pendingLabel="Enregistrement…">
        Enregistrer l&apos;encaissement
      </SubmitButton>
    </form>
  );
}
