"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { updateBusiness } from "@/features/businesses/actions";
import { formatPhone } from "@/lib/phone";

import { ReadOnlyNotice, SettingsCard } from "./settings-card";

export function BusinessInfoForm({
  editable,
  name,
  city,
  whatsappPhone,
}: {
  editable: boolean;
  name: string;
  city: string;
  whatsappPhone: string;
}) {
  const [state, action] = useActionState(updateBusiness, initialFormState);
  const values = state.values ?? {
    name,
    city,
    whatsappPhone: whatsappPhone ? formatPhone(whatsappPhone) : "",
  };

  return (
    <SettingsCard id="entreprise" title="Entreprise">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage state={state} />
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <FormField
            name="name"
            label="Nom commercial"
            defaultValue={values.name}
            required
            errors={state.fieldErrors?.name}
          />
          <FormField
            name="city"
            label="Ville (facultatif)"
            defaultValue={values.city}
            errors={state.fieldErrors?.city}
          />
          <FormField
            name="whatsappPhone"
            label="Numéro WhatsApp professionnel (facultatif)"
            type="tel"
            inputMode="tel"
            defaultValue={values.whatsappPhone}
            hint="Format camerounais accepté : 6 77 12 34 56."
            errors={state.fieldErrors?.whatsappPhone}
          />
        </fieldset>
        {editable ? (
          <SubmitButton pendingLabel="Enregistrement…">
            Enregistrer
          </SubmitButton>
        ) : (
          <ReadOnlyNotice />
        )}
      </form>
    </SettingsCard>
  );
}
