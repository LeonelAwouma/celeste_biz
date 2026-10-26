"use client";

import { startTransition, useActionState, useState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { createCampaign, updateCampaign } from "@/features/campaigns/actions";
import {
  CAMPAIGN_SOURCES,
  campaignMessage,
  suggestCampaignCode,
  type CampaignSource,
} from "@/features/campaigns/schemas";

export type CatalogChoice = { id: string; name: string };

const SOURCE_OPTIONS = Object.entries(CAMPAIGN_SOURCES).map(
  ([value, label]) => ({ value, label }),
);

export function CampaignForm({
  catalog,
  initial,
}: {
  catalog: CatalogChoice[];
  /** Campagne existante (modification) ; absent = création. */
  initial?: {
    id: string;
    code: string;
    label: string;
    source: CampaignSource;
    catalogItemId: string | null;
    message: string;
    archived: boolean;
  };
}) {
  const [state, action, pending] = useActionState(
    initial ? updateCampaign : createCampaign,
    initialFormState,
  );
  const errors = state.fieldErrors;
  const [label, setLabel] = useState(initial?.label ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [codeEdited, setCodeEdited] = useState(Boolean(initial));
  const [message, setMessage] = useState(initial?.message ?? "");
  const shownCode = codeEdited ? code : suggestCampaignCode(label);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        // Envoi manuel : le formulaire n'est pas réinitialisé après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormMessage state={state} />
      <FormField
        name="label"
        label="Nom de la campagne"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        maxLength={80}
        placeholder="Robes en wax — décembre"
        hint="Pour vous retrouver ; le client ne le voit pas."
        errors={errors?.label}
      />
      <FormField
        name="code"
        label="Code de référence"
        value={shownCode}
        onChange={(event) => {
          setCodeEdited(true);
          setCode(event.target.value.toUpperCase());
        }}
        readOnly={Boolean(initial)}
        maxLength={24}
        autoCapitalize="characters"
        hint={
          initial
            ? "Le code ne change plus : il figure déjà dans vos publications."
            : "Ajouté à la fin du message : vous saurez d'où vient le client."
        }
        errors={errors?.code}
      />
      <SelectField
        name="source"
        label="Où publiez-vous ce lien ?"
        defaultValue={initial?.source ?? "whatsapp_status"}
        options={SOURCE_OPTIONS}
        errors={errors?.source}
      />
      <SelectField
        name="catalogItemId"
        label="Article concerné (facultatif)"
        defaultValue={initial?.catalogItemId ?? ""}
        options={[
          { value: "", label: "Aucun article précis" },
          ...catalog.map((item) => ({ value: item.id, label: item.name })),
        ]}
        onChange={(event) => {
          const item = catalog.find((c) => c.id === event.target.value);
          if (item && !message.trim()) {
            setMessage(
              `Bonjour, je suis intéressé(e) par « ${item.name} ». Est-ce disponible ?`,
            );
          }
        }}
        errors={errors?.catalogItemId}
      />
      <TextareaField
        name="message"
        label="Message prérempli"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Bonjour, je souhaite commander…"
        hint="Le client peut le modifier avant de l'envoyer."
        errors={errors?.message}
      />
      {message.trim() && shownCode ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium">Message reçu sur WhatsApp</p>
          <p
            data-testid="campaign-message-preview"
            className="rounded-lg bg-emerald-50 p-3 text-sm break-words whitespace-pre-line text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50"
          >
            {campaignMessage(message.trim(), shownCode)}
          </p>
        </div>
      ) : null}
      {initial ? (
        <CheckboxField
          name="archived"
          label="Archiver la campagne"
          description="Le lien affichera « offre plus active » ; les chiffres restent consultables."
          defaultChecked={initial.archived}
        />
      ) : null}
      <SubmitButton pending={pending} pendingLabel="Enregistrement…" size="lg">
        {initial ? "Enregistrer" : "Créer le lien"}
      </SubmitButton>
    </form>
  );
}
