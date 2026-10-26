"use client";

import { startTransition, useActionState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { saveWebsite } from "@/features/websites/actions";
import type { SiteContent } from "@/features/websites/schemas";
import {
  SITE_ACCENTS,
  SITE_TEMPLATES,
  type SiteTemplateKey,
} from "@/features/websites/templates";

export type ServiceOption = {
  id: string;
  name: string;
  priceLabel: string;
};

/** Textes, modèle, adresse et prestations du brouillon. */
export function SiteEditorForm({
  version,
  templateKey,
  slug,
  content,
  services,
  publicBase,
}: {
  version: number;
  templateKey: SiteTemplateKey;
  slug: string;
  content: SiteContent;
  services: ServiceOption[];
  /** Préfixe affiché devant l'adresse (`https://…/sites/`). */
  publicBase: string;
}) {
  const [state, action, pending] = useActionState(
    saveWebsite,
    initialFormState,
  );
  const errors = state.fieldErrors;
  const selected = new Set(content.serviceIds);
  const template = SITE_TEMPLATES[templateKey];

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        // Envoi manuel : le formulaire n'est pas réinitialisé après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <input type="hidden" name="version" value={version} />
      <FormMessage state={state} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Modèle</legend>
        {Object.values(SITE_TEMPLATES).map((entry) => (
          <label
            key={entry.key}
            className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary"
          >
            <input
              type="radio"
              name="templateKey"
              value={entry.key}
              defaultChecked={entry.key === templateKey}
              className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
            />
            <span className="flex flex-col">
              <span className="font-medium">{entry.label}</span>
              <span className="text-sm text-muted-foreground">
                {entry.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <FormField
        name="slug"
        id="site-slug"
        label="Adresse du site"
        defaultValue={slug}
        maxLength={60}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        hint={`${publicBase}… — lettres minuscules, chiffres et tirets.`}
        errors={errors?.slug}
      />
      <FormField
        name="headline"
        id="site-headline"
        label="Accroche (facultatif)"
        defaultValue={content.headline ?? ""}
        maxLength={120}
        placeholder={template.headlinePlaceholder}
        errors={errors?.headline}
      />
      <TextareaField
        name="about"
        id="site-about"
        label="Présentation (facultatif)"
        defaultValue={content.about ?? ""}
        maxLength={1200}
        rows={4}
        errors={errors?.about}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextareaField
          name="hours"
          id="site-hours"
          label="Horaires (facultatif)"
          defaultValue={content.hours ?? ""}
          maxLength={300}
          rows={3}
          placeholder={"Lundi au samedi : 8 h – 18 h"}
          errors={errors?.hours}
        />
        <FormField
          name="area"
          id="site-area"
          label="Quartier ou zone (facultatif)"
          defaultValue={content.area ?? ""}
          maxLength={120}
          hint="Restez approximatif : pas d'adresse exacte."
          errors={errors?.area}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">Couleur</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SITE_ACCENTS).map(([key, accent]) => (
            <label
              key={key}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-primary/30"
            >
              <input
                type="radio"
                name="accent"
                value={key}
                defaultChecked={key === content.accent}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className="size-5 rounded-full"
                style={{ backgroundColor: accent.color }}
              />
              <span className="text-sm">{accent.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Prestations affichées</legend>
        <p className="text-sm text-muted-foreground">
          Seuls les articles publics et actifs du catalogue sont proposés. Leur
          prix est copié au moment de la publication.
        </p>
        {services.length ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {services.map((service) => (
              <li key={service.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    defaultChecked={selected.has(service.id)}
                    className="size-5 shrink-0 accent-[var(--primary)]"
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="break-words">{service.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {service.priceLabel}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm">
            Aucun article public dans le catalogue pour l&apos;instant.
          </p>
        )}
        {errors?.serviceIds ? (
          <p className="text-sm text-destructive">{errors.serviceIds[0]}</p>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="showPrices"
            defaultChecked={content.showPrices}
            className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
          />
          <span className="flex flex-col">
            <span className="font-medium">Afficher les prix</span>
            <span className="text-sm text-muted-foreground">
              Sinon : « Prix sur demande ».
            </span>
          </span>
        </label>
      </fieldset>

      <SubmitButton pending={pending} pendingLabel="Enregistrement…" size="lg">
        Enregistrer le brouillon
      </SubmitButton>
    </form>
  );
}
