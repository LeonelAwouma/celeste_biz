"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { setOrderCampaign } from "@/features/campaigns/actions";

/** Provenance déclarée : d'après la référence lue dans la conversation. */
export function OrderCampaignForm({
  orderId,
  current,
  campaigns,
}: {
  orderId: string;
  current: string | null;
  campaigns: { id: string; code: string; label: string }[];
}) {
  const [state, action] = useActionState(setOrderCampaign, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <SelectField
        name="campaignId"
        id="order-campaign"
        label="Campagne (référence « Réf. » du message)"
        defaultValue={current ?? ""}
        options={[
          { value: "", label: "Aucune ou inconnue" },
          ...campaigns.map((c) => ({
            value: c.id,
            label: `${c.code} — ${c.label}`,
          })),
          ...(current && !campaigns.some((c) => c.id === current)
            ? [{ value: current, label: "Campagne archivée" }]
            : []),
        ]}
      />
      <SubmitButton variant="outline" pendingLabel="…">
        Enregistrer la provenance
      </SubmitButton>
    </form>
  );
}
