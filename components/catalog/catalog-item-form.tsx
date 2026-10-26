"use client";

import { useActionState, useState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { saveCatalogItem } from "@/features/catalog/actions";
import {
  ITEM_KINDS,
  ITEM_KIND_LABELS,
  PRICE_MODES,
  PRICE_MODE_LABELS,
} from "@/features/catalog/schemas";

type CatalogItemValues = {
  id: string;
  kind: string;
  name: string;
  description: string;
  category: string;
  priceMode: string;
  price: string;
  unit: string;
  visible: boolean;
  position: string;
};

const KIND_OPTIONS = ITEM_KINDS.map((value) => ({
  value,
  label: ITEM_KIND_LABELS[value],
}));
const PRICE_MODE_OPTIONS = PRICE_MODES.map((value) => ({
  value,
  label: PRICE_MODE_LABELS[value],
}));

export function CatalogItemForm({
  mode,
  item,
  categories,
  defaultKind = "service",
  readOnly = false,
}: {
  mode: "create" | "edit";
  item?: CatalogItemValues;
  categories: string[];
  defaultKind?: "service" | "product";
  readOnly?: boolean;
}) {
  const [state, action] = useActionState(saveCatalogItem, initialFormState);
  // Identifiant stable : un double envoi ne crée qu'un article.
  const [id] = useState(() => item?.id ?? crypto.randomUUID());
  const values = state.values;
  const [priceMode, setPriceMode] = useState(
    values?.priceMode ?? item?.priceMode ?? "fixed",
  );

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      <FormMessage state={state} />
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <FormField
          name="name"
          label="Nom"
          defaultValue={values?.name ?? item?.name}
          autoComplete="off"
          required
          maxLength={120}
          errors={state.fieldErrors?.name}
        />
        {/* Les listes déroulantes sont recréées après un envoi : la
            réinitialisation du formulaire reprend alors la valeur saisie. */}
        <SelectField
          key={`kind-${values?.kind}`}
          name="kind"
          label="Type"
          options={KIND_OPTIONS}
          defaultValue={values?.kind ?? item?.kind ?? defaultKind}
          errors={state.fieldErrors?.kind}
        />
        <SelectField
          key={`priceMode-${values?.priceMode}`}
          name="priceMode"
          label="Prix"
          options={PRICE_MODE_OPTIONS}
          defaultValue={priceMode}
          onChange={(event) => setPriceMode(event.target.value)}
          errors={state.fieldErrors?.priceMode}
        />
        {priceMode === "quote" ? (
          <p className="text-sm text-muted-foreground">
            Le prix sera fixé dans le devis ou la commande.
          </p>
        ) : (
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <FormField
              name="price"
              label={
                priceMode === "from"
                  ? "Montant minimum (FCFA)"
                  : "Montant (FCFA)"
              }
              inputMode="decimal"
              placeholder="Ex. 15 000"
              defaultValue={values?.price ?? item?.price}
              required
              errors={state.fieldErrors?.price}
            />
            <FormField
              name="unit"
              label="Unité"
              placeholder="Ex. pièce"
              defaultValue={values?.unit ?? item?.unit}
              maxLength={30}
              errors={state.fieldErrors?.unit}
            />
          </div>
        )}
        <FormField
          name="category"
          label="Catégorie (facultatif)"
          list="catalog-categories"
          placeholder="Ex. Robes, Gâteaux"
          defaultValue={values?.category ?? item?.category}
          maxLength={60}
          errors={state.fieldErrors?.category}
        />
        <datalist id="catalog-categories">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
        <TextareaField
          name="description"
          label="Description (facultatif)"
          defaultValue={values?.description ?? item?.description}
          maxLength={500}
          errors={state.fieldErrors?.description}
        />
        <FormField
          name="position"
          label="Ordre d'affichage"
          hint="Les plus petits nombres apparaissent en premier."
          inputMode="numeric"
          defaultValue={values?.position ?? item?.position ?? "0"}
          errors={state.fieldErrors?.position}
        />
        <CheckboxField
          name="visible"
          label="Visible par les clients"
          description="Décochez pour un article réservé à l'usage interne."
          defaultChecked={
            values ? values.visible === "on" : (item?.visible ?? true)
          }
        />
      </fieldset>
      {readOnly ? null : (
        <SubmitButton pendingLabel="Enregistrement…">
          {mode === "create"
            ? "Enregistrer l'article"
            : "Enregistrer les modifications"}
        </SubmitButton>
      )}
    </form>
  );
}
