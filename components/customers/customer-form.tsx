"use client";

import { useActionState, useState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { saveCustomer } from "@/features/customers/actions";

type CustomerValues = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  marketingConsent: boolean;
  marketingConsentAt: string | null;
};

const consentDate = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Africa/Douala",
});

export function CustomerForm({
  mode,
  customer,
  readOnly = false,
}: {
  mode: "create" | "edit";
  customer?: CustomerValues;
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(saveCustomer, initialFormState);
  // Identifiant stable pour cette saisie : un double envoi ne crée qu'un client.
  const [id] = useState(() => customer?.id ?? crypto.randomUUID());
  const values = state.values;
  const duplicate = state.data?.duplicate === "1";

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      {duplicate ? (
        <input type="hidden" name="confirmDuplicate" value="1" />
      ) : null}
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <FormField
          name="name"
          label="Nom ou surnom"
          defaultValue={values?.name ?? customer?.name}
          autoComplete="off"
          required
          errors={state.fieldErrors?.name}
        />
        <FormField
          name="phone"
          label="Téléphone (facultatif)"
          type="tel"
          inputMode="tel"
          placeholder="Ex. 6 77 12 34 56"
          defaultValue={values?.phone ?? customer?.phone}
          errors={state.fieldErrors?.phone}
        />
        <FormField
          name="email"
          label="E-mail (facultatif)"
          type="email"
          inputMode="email"
          defaultValue={values?.email ?? customer?.email}
          errors={state.fieldErrors?.email}
        />
        <TextareaField
          name="notes"
          label="Notes internes (facultatif)"
          hint="Visibles uniquement par votre équipe, jamais par le client."
          defaultValue={values?.notes ?? customer?.notes}
          maxLength={2000}
          errors={state.fieldErrors?.notes}
        />
        <CheckboxField
          name="marketingConsent"
          label="Accepte de recevoir des offres et nouveautés"
          description={
            customer?.marketingConsentAt
              ? `Accord enregistré le ${consentDate.format(new Date(customer.marketingConsentAt))}.`
              : "À cocher seulement si le client l'a demandé ou accepté."
          }
          defaultChecked={
            values
              ? values.marketingConsent === "on"
              : customer?.marketingConsent
          }
        />
      </fieldset>
      {readOnly ? null : (
        <SubmitButton pendingLabel="Enregistrement…">
          {duplicate
            ? "Enregistrer quand même"
            : mode === "create"
              ? "Enregistrer le client"
              : "Enregistrer les modifications"}
        </SubmitButton>
      )}
    </form>
  );
}
