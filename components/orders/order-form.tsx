"use client";

import { startTransition, useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/features/auth/schemas";
import { formatCatalogPrice } from "@/features/catalog/format";
import { saveOrder } from "@/features/orders/actions";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from "@/features/orders/status";
import type { OrderField } from "@/features/professions/schema";
import { computeLine, parseDecimal, sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf, parseXafAmount, toInputAmount } from "@/lib/monetary/xaf";

import { CustomerPicker, type PickedCustomer } from "./customer-picker";
import { OrderDetailFields } from "./order-detail-fields";

export type CatalogOption = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  priceMode: "fixed" | "from" | "quote";
  price: string | null;
};

export type LineValues = {
  catalogItemId: string | null;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};

type Line = LineValues & { key: string; showOptions: boolean };

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

const emptyLine = (): Line => ({
  key: crypto.randomUUID(),
  catalogItemId: null,
  name: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discount: "",
  taxRate: "",
  showOptions: false,
});

/** Montants d'une ligne pour l'aperçu, ou null si la saisie est incomplète. */
function previewLine(line: LineValues) {
  const quantity = parseDecimal(line.quantity, 3);
  const unitPrice = parseXafAmount(line.unitPrice);
  const discount = line.discount.trim() ? parseXafAmount(line.discount) : "0";
  const taxRate = line.taxRate.trim()
    ? parseDecimal(line.taxRate.replace("%", ""), 2)
    : "0";
  if (!quantity || !unitPrice || discount === null || taxRate === null)
    return null;
  return computeLine(quantity, unitPrice, discount, taxRate);
}

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
  const [lines, setLines] = useState<Line[]>(() =>
    initial?.lines.length
      ? initial.lines.map((line) => ({
          ...line,
          key: crypto.randomUUID(),
          showOptions: false,
        }))
      : [emptyLine()],
  );
  const values = state.values ?? {};
  const errors = state.fieldErrors;

  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  function addFromCatalog(catalogId: string) {
    const item = catalog.find((entry) => entry.id === catalogId);
    if (!item) return;
    const line: Line = {
      ...emptyLine(),
      catalogItemId: item.id,
      name: item.name,
      unit: item.unit ?? "",
      unitPrice: item.price ? toInputAmount(item.price) : "",
    };
    // Remplace la première ligne si elle est encore vide.
    setLines((current) =>
      current.length === 1 && !current[0].name && !current[0].unitPrice
        ? [line]
        : [...current, line],
    );
  }

  const previews = lines.map(previewLine);
  const total = sumAmounts(
    previews.flatMap((preview) => (preview ? [preview.total] : [])),
  );
  const incomplete = previews.some((preview) => preview === null);

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
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(
            ({
              catalogItemId,
              name,
              unit,
              quantity,
              unitPrice,
              discount,
              taxRate,
            }) => ({
              catalogItemId: catalogItemId ?? "",
              name,
              unit,
              quantity,
              unitPrice,
              discount,
              taxRate,
            }),
          ),
        )}
      />
      <FormMessage state={state} />

      <CustomerPicker
        initial={initial?.customer ?? initialCustomer}
        values={values}
        errors={errors}
        disabled={itemsLocked}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-semibold">Articles et prix</legend>
        {itemsLocked ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            Commande confirmée : le client, les lignes et les prix sont figés.
          </p>
        ) : null}
        {errors?.items?.length ? (
          <ul className="text-sm text-destructive" role="alert">
            {errors.items.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <ol className="flex flex-col gap-3" aria-label="Lignes de la commande">
          {lines.map((line, index) => {
            const preview = previews[index];
            const prefix = `line-${line.key}`;
            return (
              <li
                key={line.key}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3"
              >
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Label htmlFor={`${prefix}-name`}>Ligne {index + 1}</Label>
                    <Input
                      id={`${prefix}-name`}
                      value={line.name}
                      disabled={itemsLocked}
                      placeholder="Ex. Robe en wax, Gâteau 3 étages"
                      onChange={(event) =>
                        update(line.key, {
                          name: event.target.value,
                          catalogItemId: null,
                        })
                      }
                      maxLength={200}
                      aria-label={`Libellé de la ligne ${index + 1}`}
                    />
                  </div>
                  {itemsLocked || lines.length === 1 ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Retirer la ligne ${index + 1}`}
                      onClick={() =>
                        setLines((current) =>
                          current.filter((l) => l.key !== line.key),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${prefix}-qty`}>Quantité</Label>
                    <Input
                      id={`${prefix}-qty`}
                      inputMode="decimal"
                      value={line.quantity}
                      disabled={itemsLocked}
                      onChange={(event) =>
                        update(line.key, { quantity: event.target.value })
                      }
                      aria-label={`Quantité de la ligne ${index + 1}`}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${prefix}-price`}>
                      Prix unitaire (FCFA){line.unit ? ` / ${line.unit}` : ""}
                    </Label>
                    <Input
                      id={`${prefix}-price`}
                      inputMode="decimal"
                      value={line.unitPrice}
                      disabled={itemsLocked}
                      placeholder="Ex. 15 000"
                      onChange={(event) =>
                        update(line.key, { unitPrice: event.target.value })
                      }
                      aria-label={`Prix unitaire de la ligne ${index + 1}`}
                    />
                  </div>
                </div>
                {line.showOptions ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${prefix}-discount`}>
                        Remise (FCFA)
                      </Label>
                      <Input
                        id={`${prefix}-discount`}
                        inputMode="decimal"
                        value={line.discount}
                        disabled={itemsLocked}
                        onChange={(event) =>
                          update(line.key, { discount: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${prefix}-tax`}>Taxe (%)</Label>
                      <Input
                        id={`${prefix}-tax`}
                        inputMode="decimal"
                        value={line.taxRate}
                        disabled={itemsLocked}
                        placeholder="0"
                        onChange={(event) =>
                          update(line.key, { taxRate: event.target.value })
                        }
                      />
                    </div>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2 text-sm">
                  {itemsLocked ? (
                    <span />
                  ) : (
                    <button
                      type="button"
                      className="min-h-9 text-primary"
                      onClick={() =>
                        update(line.key, { showOptions: !line.showOptions })
                      }
                    >
                      {line.showOptions
                        ? "Masquer remise et taxe"
                        : "Remise ou taxe"}
                    </button>
                  )}
                  <span className="font-medium" aria-live="polite">
                    {preview ? formatXaf(preview.total) : "—"}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {itemsLocked ? null : (
          <div className="flex flex-col gap-2">
            {catalog.length ? (
              <>
                <Label htmlFor="add-catalog-item">
                  Ajouter depuis le catalogue
                </Label>
                <select
                  id="add-catalog-item"
                  value=""
                  onChange={(event) => addFromCatalog(event.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base"
                >
                  <option value="">— Choisir un article —</option>
                  {catalog.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ·{" "}
                      {formatCatalogPrice(
                        item.priceMode,
                        item.price,
                        item.unit,
                      )}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLines((current) => [...current, emptyLine()])}
            >
              <Plus aria-hidden="true" />
              Ajouter une ligne libre
            </Button>
          </div>
        )}

        <p className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-accent-foreground">
          <span className="font-medium">Total estimé</span>
          <span className="text-lg font-bold" data-testid="order-total">
            {formatXaf(total)}
            {incomplete ? " *" : ""}
          </span>
        </p>
        {incomplete ? (
          <p className="text-xs text-muted-foreground">
            * Hors lignes incomplètes. Le total définitif est calculé à
            l&apos;enregistrement.
          </p>
        ) : null}
      </fieldset>

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
