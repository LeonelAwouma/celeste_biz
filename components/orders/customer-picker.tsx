"use client";

import { useEffect, useState, useTransition } from "react";
import { Search, UserPlus, X } from "lucide-react";

import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findCustomersForOrder } from "@/features/orders/actions";
import { formatPhone } from "@/lib/phone";

export type PickedCustomer = { id: string; name: string; phone: string | null };

/**
 * Choix du client : recherche parmi les fiches existantes ou fiche minimale
 * (nom, téléphone facultatif) créée avec la commande.
 */
export function CustomerPicker({
  initial,
  values,
  errors,
  disabled,
}: {
  initial?: PickedCustomer | null;
  values?: Record<string, string>;
  errors?: Record<string, string[] | undefined>;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"existing" | "new">(
    values?.customerMode === "new" ? "new" : "existing",
  );
  const [selected, setSelected] = useState<PickedCustomer | null>(
    initial ?? null,
  );
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [searching, startSearch] = useTransition();
  // Identifiant de la nouvelle fiche, stable pendant la saisie.
  const [newCustomerId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (mode !== "existing" || selected) return;
    const handle = setTimeout(() => {
      startSearch(async () =>
        setResults(await findCustomersForOrder(query.trim())),
      );
    }, 250);
    return () => clearTimeout(handle);
  }, [query, mode, selected]);

  return (
    <>
      {/* Hors du fieldset : un champ désactivé n'est pas envoyé. */}
      <input type="hidden" name="customerMode" value={mode} />
      <input
        type="hidden"
        name="customerId"
        value={mode === "existing" ? (selected?.id ?? "") : ""}
      />
      <input
        type="hidden"
        name="newCustomerId"
        value={mode === "new" ? newCustomerId : ""}
      />
      <fieldset disabled={disabled} className="flex flex-col gap-3">
        <legend className="mb-1 text-lg font-semibold">Client</legend>

        {mode === "new" ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3">
            <FormField
              name="newCustomerName"
              label="Nom ou surnom du nouveau client"
              defaultValue={values?.newCustomerName}
              autoComplete="off"
              errors={errors?.newCustomerName}
            />
            <FormField
              name="newCustomerPhone"
              label="Téléphone (facultatif)"
              type="tel"
              inputMode="tel"
              placeholder="Ex. 6 77 12 34 56"
              defaultValue={values?.newCustomerPhone}
              errors={errors?.newCustomerPhone}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setMode("existing")}
            >
              Choisir plutôt un client existant
            </Button>
          </div>
        ) : selected ? (
          <div className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-2">
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{selected.name}</span>
              {selected.phone ? (
                <span className="text-sm text-muted-foreground">
                  {formatPhone(selected.phone)}
                </span>
              ) : null}
            </span>
            {disabled ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSelected(null)}
                aria-label={`Changer de client (${selected.name})`}
              >
                <X aria-hidden="true" />
                Changer
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor="customer-search" className="sr-only">
              Rechercher un client
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="customer-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nom ou téléphone du client"
                className="pl-10"
                autoComplete="off"
                aria-describedby={
                  errors?.customerId ? "customer-error" : undefined
                }
                aria-invalid={errors?.customerId ? true : undefined}
              />
            </div>
            {errors?.customerId ? (
              <p id="customer-error" className="text-sm text-destructive">
                {errors.customerId[0]}
              </p>
            ) : null}
            <ul
              aria-label="Clients trouvés"
              aria-busy={searching}
              className="divide-y rounded-xl border bg-card"
            >
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start px-4 py-2 text-left hover:bg-accent"
                    onClick={() => setSelected(customer)}
                  >
                    <span className="font-medium">{customer.name}</span>
                    {customer.phone ? (
                      <span className="text-sm text-muted-foreground">
                        {formatPhone(customer.phone)}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {!searching && results.length === 0 ? (
                <li className="px-4 py-3 text-sm text-muted-foreground">
                  {query
                    ? "Aucun client trouvé."
                    : "Aucun client pour l'instant."}
                </li>
              ) : null}
            </ul>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("new")}
            >
              <UserPlus aria-hidden="true" />
              Nouveau client
            </Button>
          </div>
        )}
      </fieldset>
    </>
  );
}
