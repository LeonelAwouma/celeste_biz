"use client";

import { startTransition, useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import {
  CustomerPicker,
  type PickedCustomer,
} from "@/components/orders/customer-picker";
import {
  LineItemsEditor,
  type CatalogOption,
  type LineValues,
} from "@/components/orders/line-items-editor";
import { initialFormState } from "@/features/auth/schemas";
import { saveQuote } from "@/features/quotes/actions";

export type QuoteFormInitial = {
  id: string;
  version: number;
  customer: PickedCustomer;
  lines: LineValues[];
  validUntil: string;
  conditions: string;
  notes: string;
};

export function QuoteForm({
  mode,
  initial,
  initialCustomer,
  defaultValidUntil,
  catalog,
}: {
  mode: "create" | "edit";
  initial?: QuoteFormInitial;
  initialCustomer?: PickedCustomer | null;
  defaultValidUntil: string;
  catalog: CatalogOption[];
}) {
  const [state, action, pending] = useActionState(saveQuote, initialFormState);
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const values = state.values ?? {};
  const errors = state.fieldErrors;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        // Envoi manuel : le formulaire n'est pas réinitialisé après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      {initial ? (
        <input type="hidden" name="version" value={initial.version} />
      ) : null}
      <FormMessage state={state} />

      <CustomerPicker
        initial={initial?.customer ?? initialCustomer}
        values={values}
        errors={errors}
      />

      <LineItemsEditor
        initialLines={initial?.lines}
        catalog={catalog}
        errors={errors?.items}
        listLabel="Lignes du devis"
        totalTestId="quote-total"
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">
          Validité et conditions
        </legend>
        <FormField
          name="validUntil"
          label="Valable jusqu'au (facultatif)"
          type="date"
          defaultValue={
            values.validUntil ?? initial?.validUntil ?? defaultValidUntil
          }
          errors={errors?.validUntil}
        />
        <TextareaField
          name="conditions"
          label="Conditions (facultatif)"
          hint="Imprimées sur le devis. Ex. acompte de 50 % à la commande, délai de réalisation."
          defaultValue={values.conditions ?? initial?.conditions}
          maxLength={2000}
          errors={errors?.conditions}
        />
        <TextareaField
          name="notes"
          label="Notes internes (facultatif)"
          hint="Visibles uniquement par votre équipe, jamais imprimées."
          defaultValue={values.notes ?? initial?.notes}
          maxLength={2000}
          errors={errors?.notes}
        />
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Enregistrement…" size="lg">
        {mode === "create"
          ? "Enregistrer le devis"
          : "Enregistrer les modifications"}
      </SubmitButton>
    </form>
  );
}
