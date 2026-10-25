"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { ProfessionPicker } from "@/components/onboarding/profession-picker";
import { initialFormState } from "@/features/auth/schemas";
import { updateProfession } from "@/features/businesses/actions";
import { getProfessionTemplate } from "@/features/professions/registry";

import { ReadOnlyNotice, SettingsCard } from "./settings-card";

export function ProfessionForm({
  editable,
  professionKey,
}: {
  editable: boolean;
  professionKey: string;
}) {
  const [state, action] = useActionState(updateProfession, initialFormState);

  return (
    <SettingsCard
      id="metier"
      title="Métier"
      description="Il détermine les informations demandées à chaque commande et les modules proposés. Les commandes déjà enregistrées ne sont pas modifiées."
    >
      {editable ? (
        <form action={action} className="flex flex-col gap-4" noValidate>
          <FormMessage state={state} />
          <ProfessionPicker
            key={professionKey}
            defaultValue={professionKey}
            errors={state.fieldErrors?.professionKey}
          />
          <SubmitButton pendingLabel="Enregistrement…">
            Changer de métier
          </SubmitButton>
        </form>
      ) : (
        <>
          <p className="font-medium">
            {getProfessionTemplate(professionKey).label}
          </p>
          <ReadOnlyNotice />
        </>
      )}
    </SettingsCard>
  );
}
