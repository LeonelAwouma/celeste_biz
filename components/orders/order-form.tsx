"use client";

import { startTransition, useActionState, useState } from "react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import { saveOrder } from "@/features/orders/actions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/features/orders/status";
import type { OrderField } from "@/features/professions/schema";

import { CustomerPicker, type PickedCustomer } from "./customer-picker";
import {
  LineItemsEditor,
  type CatalogOption,
  type LineValues,
} from "./line-items-editor";
import { OrderDetailFields } from "./order-detail-fields";

export type { CatalogOption, LineValues };

export type OrderFormInitial = {
  id: string;
  version: number;
  customer: PickedCustomer;
  lines: LineValues[];
  dueDate: string;
  dueTime: string;
  assigneeId: string;
  notes: string;
  productionStep: string;
  details: Record<string, string>;
};

export function OrderForm({
  mode,
  initial,
  initialCustomer,
  catalog,
  members,
  fields,
  productionSteps = [],
  itemsLocked = false,
  orderLabel,
}: {
  mode: "create" | "edit";
  initial?: OrderFormInitial;
  initialCustomer?: PickedCustomer | null;
  catalog: CatalogOption[];
  members: { userId: string; displayName: string }[];
  fields: readonly OrderField[];
  productionSteps?: readonly { key: string; label: string }[];
  itemsLocked?: boolean;
  orderLabel: string;
}) {
  const [state, action, pending] = useActionState(saveOrder, initialFormState);
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [depositId] = useState(() => crypto.randomUUID());
  const values = state.values ?? {};
  const errors = state.fieldErrors;

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        // Envoi manuel : le formulaire n'est pas réinitialisé après une erreur.
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mode" value={mode} />
      {initial ? (
        <input type="hidden" name="version" value={initial.version} />
      ) : null}
      <FormMessage state={state} />

      <CustomerPicker
        initial={initial?.customer ?? initialCustomer}
        values={values}
        errors={errors}
        disabled={itemsLocked}
      />

      <LineItemsEditor
        initialLines={initial?.lines}
        catalog={catalog}
        locked={itemsLocked}
        lockedNotice="Commande confirmée : le client, les lignes et les prix sont figés."
        errors={errors?.items}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-lg font-semibold">{orderLabel}</legend>
        <div className="grid grid-cols-[1fr_7.5rem] gap-3">
          <FormField
            name="dueDate"
            label="À remettre le (facultatif)"
            type="date"
            defaultValue={values.dueDate ?? initial?.dueDate}
            errors={errors?.dueDate}
          />
          <FormField
            name="dueTime"
            label="Heure"
            type="time"
            defaultValue={values.dueTime ?? initial?.dueTime}
            errors={errors?.dueTime}
          />
        </div>
        <OrderDetailFields
          fields={fields}
          values={{ ...initial?.details, ...values }}
          errors={errors}
        />
        {productionSteps.length ? (
          <SelectField
            name="productionStep"
            label="Étape de réalisation"
            defaultValue={
              values.productionStep ?? initial?.productionStep ?? ""
            }
            options={[
              { value: "", label: "— Non précisée —" },
              ...productionSteps.map((s) => ({ value: s.key, label: s.label })),
            ]}
          />
        ) : null}
        {members.length > 1 ? (
          <SelectField
            name="assigneeId"
            label="Responsable (facultatif)"
            defaultValue={values.assigneeId ?? initial?.assigneeId ?? ""}
            errors={errors?.assigneeId}
            options={[
              { value: "", label: "— Personne —" },
              ...members.map((m) => ({
                value: m.userId,
                label: m.displayName,
              })),
            ]}
          />
        ) : null}
        <TextareaField
          name="notes"
          label="Notes internes (facultatif)"
          hint="Visibles uniquement par votre équipe."
          defaultValue={values.notes ?? initial?.notes}
          maxLength={2000}
          errors={errors?.notes}
        />
      </fieldset>

      {mode === "create" ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-lg font-semibold">
            Acompte reçu (facultatif)
          </legend>
          <input type="hidden" name="depositId" value={depositId} />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              name="depositAmount"
              label="Montant (FCFA)"
              inputMode="decimal"
              placeholder="Ex. 10 000"
              defaultValue={values.depositAmount}
              errors={errors?.depositAmount}
            />
            <SelectField
              name="depositMethod"
              label="Moyen"
              defaultValue={values.depositMethod ?? "cash"}
              errors={errors?.depositMethod}
              options={PAYMENT_METHODS.map((method) => ({
                value: method,
                label: PAYMENT_METHOD_LABELS[method],
              }))}
            />
          </div>
          <FormField
            name="depositReference"
            label="Référence de la transaction (facultatif)"
            hint="Enregistré comme déclaré : Céleste Biz ne vérifie pas le paiement auprès de l'opérateur."
            defaultValue={values.depositReference}
            errors={errors?.depositReference}
          />
          <CheckboxField
            name="asDraft"
            label="Enregistrer comme brouillon"
            description="La commande ne sera pas encore confirmée ; lignes et prix restent modifiables."
            defaultChecked={values.asDraft === "on"}
          />
        </fieldset>
      ) : null}

      <SubmitButton pending={pending} pendingLabel="Enregistrement…" size="lg">
        {mode === "create"
          ? "Enregistrer la commande"
          : "Enregistrer les modifications"}
      </SubmitButton>
    </form>
  );
}
