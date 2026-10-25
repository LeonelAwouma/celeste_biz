"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { updatePassword } from "@/features/auth/actions";
import { initialFormState } from "@/features/auth/schemas";

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="password"
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum, avec au moins une lettre et un chiffre."
        required
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirmation"
        label="Confirmez le mot de passe"
        type="password"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmation}
      />
      <SubmitButton pendingLabel="Enregistrement…">
        Enregistrer le mot de passe
      </SubmitButton>
    </form>
  );
}
