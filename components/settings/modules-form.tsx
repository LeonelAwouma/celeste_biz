"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { updateModules } from "@/features/businesses/actions";
import type { ModuleOverrides } from "@/features/professions/modules";
import { OPTIONAL_MODULE_INFO } from "@/features/professions/registry";
import type { OptionalModule } from "@/features/professions/schema";

import { ReadOnlyNotice, SettingsCard } from "./settings-card";

export function ModulesForm({
  editable,
  available,
  defaults,
  overrides,
}: {
  editable: boolean;
  available: OptionalModule[];
  defaults: OptionalModule[];
  overrides: ModuleOverrides;
}) {
  const [state, action] = useActionState(updateModules, initialFormState);

  return (
    <SettingsCard
      id="modules"
      title="Modules"
      description="Commandes, clients, catalogue, encaissements et factures sont toujours actifs. Les modules ci-dessous sont facultatifs."
    >
      <form action={action} className="flex flex-col gap-4">
        <FormMessage state={state} />
        <fieldset disabled={!editable} className="flex flex-col gap-2">
          <legend className="sr-only">Modules facultatifs</legend>
          {available.map((module) => (
            <label
              key={module}
              className="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border p-3"
            >
              <input
                type="checkbox"
                name={`module_${module}`}
                defaultChecked={overrides[module] ?? defaults.includes(module)}
                className="mt-1 size-4 accent-[var(--primary)]"
              />
              <span className="flex flex-col">
                <span className="font-medium">
                  {OPTIONAL_MODULE_INFO[module].label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {OPTIONAL_MODULE_INFO[module].description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        {editable ? (
          <SubmitButton pendingLabel="Enregistrement…">
            Enregistrer les modules
          </SubmitButton>
        ) : (
          <ReadOnlyNotice />
        )}
      </form>
    </SettingsCard>
  );
}
