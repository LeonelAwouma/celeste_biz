"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { signIn } from "@/features/auth/actions";
import { initialFormState } from "@/features/auth/schemas";

const LINK_ERRORS: Record<string, string> = {
  lien: "Ce lien est invalide ou a expiré. Connectez-vous ou demandez un nouveau lien.",
};

export function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useActionState(signIn, initialFormState);
  const linkError = LINK_ERRORS[params.get("erreur") ?? ""];

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      {linkError && state.status === "idle" ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {linkError}
        </p>
      ) : null}
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
      <FormField
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Connexion…">Se connecter</SubmitButton>
      <Link
        href="/reset-password"
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Mot de passe oublié ?
      </Link>
    </form>
  );
}
