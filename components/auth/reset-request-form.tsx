"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { requestPasswordReset } from "@/features/auth/actions";
import { initialFormState } from "@/features/auth/schemas";

export function ResetRequestForm() {
  const [state, action] = useActionState(
    requestPasswordReset,
    initialFormState,
  );

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="email"
        defaultValue={state.values?.email}
        label="Adresse e-mail"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        errors={state.fieldErrors?.email}
      />
      <SubmitButton>Recevoir un lien</SubmitButton>
    </form>
  );
}
