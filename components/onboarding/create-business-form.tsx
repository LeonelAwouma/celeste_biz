"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { createBusiness } from "@/features/businesses/actions";

export function CreateBusinessForm() {
  const [state, action] = useActionState(createBusiness, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="name"
        defaultValue={state.values?.name}
        label="Nom commercial"
        placeholder="Ex. Atelier Grâce Couture"
        autoComplete="organization"
        required
        errors={state.fieldErrors?.name}
      />
      <FormField
        name="city"
        defaultValue={state.values?.city}
        label="Ville (facultatif)"
        placeholder="Ex. Douala"
        autoComplete="address-level2"
        errors={state.fieldErrors?.city}
      />
      <SubmitButton pendingLabel="Création…">Créer mon entreprise</SubmitButton>
    </form>
  );
}
