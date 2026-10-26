"use client";

import { useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { updateFiscalProfile } from "@/features/invoices/actions";
import type { FiscalProfile } from "@/features/invoices/schemas";

import { ReadOnlyNotice, SettingsCard } from "./settings-card";

export function FiscalProfileForm({
  editable,
  profile,
}: {
  editable: boolean;
  profile: FiscalProfile;
}) {
  const [state, action] = useActionState(updateFiscalProfile, initialFormState);
  const values: Record<string, string | undefined> = state.values ?? profile;
  const errors = state.fieldErrors;

  return (
    <SettingsCard
      id="facturation"
      title="Profil de facturation"
      description="Informations imprimées sur vos factures. Céleste Biz ne vérifie pas ces identifiants : ils restent sous votre responsabilité."
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage state={state} />
        <fieldset disabled={!editable} className="flex flex-col gap-4">
          <FormField
            name="legal_name"
            id="fiscal-legal_name"
            label="Raison sociale ou nom légal"
            defaultValue={values.legal_name}
            maxLength={200}
            hint="Obligatoire pour émettre une facture."
            errors={errors?.legal_name}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="niu"
              id="fiscal-niu"
              label="NIU (facultatif)"
              defaultValue={values.niu}
              maxLength={200}
              errors={errors?.niu}
            />
            <FormField
              name="rccm"
              id="fiscal-rccm"
              label="RCCM (facultatif)"
              defaultValue={values.rccm}
              maxLength={200}
              errors={errors?.rccm}
            />
          </div>
          <FormField
            name="tax_regime"
            id="fiscal-tax_regime"
            label="Régime fiscal (facultatif)"
            defaultValue={values.tax_regime}
            maxLength={200}
            errors={errors?.tax_regime}
          />
          <FormField
            name="address"
            id="fiscal-address"
            label="Adresse (facultatif)"
            defaultValue={values.address}
            maxLength={200}
            errors={errors?.address}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              name="phone"
              id="fiscal-phone"
              label="Téléphone de facturation (facultatif)"
              type="tel"
              defaultValue={values.phone}
              maxLength={200}
              errors={errors?.phone}
            />
            <FormField
              name="email"
              id="fiscal-email"
              label="E-mail de facturation (facultatif)"
              type="email"
              defaultValue={values.email}
              maxLength={200}
              errors={errors?.email}
            />
          </div>
          <TextareaField
            name="invoice_mentions"
            id="fiscal-invoice_mentions"
            label="Mentions à imprimer (facultatif)"
            hint="Ex. conditions de pénalités, coordonnées bancaires."
            defaultValue={values.invoice_mentions}
            maxLength={1000}
            errors={errors?.invoice_mentions}
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
