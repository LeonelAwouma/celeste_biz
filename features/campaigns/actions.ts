"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { can } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import {
  CAMPAIGN_FORM_FIELDS,
  campaignCreateSchema,
  campaignUpdateSchema,
} from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Seuls le propriétaire et le gestionnaire gèrent les campagnes.",
};

const NETWORK: FormState = {
  status: "error",
  message: "Rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
};

function rpcFailure(
  error: { code?: string; message: string },
  values?: Record<string, string>,
): FormState {
  if (error.code === "CB422") {
    return { status: "error", message: error.message, values };
  }
  if (error.code === "42501") return { ...FORBIDDEN, values };
  return { ...NETWORK, values };
}

async function authorizeCampaigns() {
  const business = await requireActiveBusiness();
  return can(business.role, "campaigns.write") ? business : null;
}

export async function createCampaign(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeCampaigns();
  if (!business) return FORBIDDEN;
  const values = keepValues(formData, CAMPAIGN_FORM_FIELDS);
  const parsed = campaignCreateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_campaign_link", {
    p_business_id: business.id,
    p_code: parsed.data.code,
    p_label: parsed.data.label,
    p_source: parsed.data.source,
    p_catalog_item_id: parsed.data.catalogItemId,
    p_message: parsed.data.message,
  });
  if (error || !data) return error ? rpcFailure(error, values) : NETWORK;

  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${data}?cree=1`);
}

export async function updateCampaign(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await authorizeCampaigns();
  if (!business) return FORBIDDEN;
  const values = keepValues(formData, CAMPAIGN_FORM_FIELDS);
  const parsed = campaignUpdateSchema.safeParse({
    ...Object.fromEntries(formData),
    archived: formData.get("archived") === "on",
  });
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_campaign_link", {
    p_id: parsed.data.id,
    p_label: parsed.data.label,
    p_source: parsed.data.source,
    p_catalog_item_id: parsed.data.catalogItemId,
    p_message: parsed.data.message,
    p_archived: parsed.data.archived,
  });
  if (error) return rpcFailure(error, values);

  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${parsed.data.id}`);
  return {
    status: "success",
    message: parsed.data.archived
      ? "Campagne archivée : son lien affiche « lien indisponible »."
      : "Campagne enregistrée.",
  };
}

/** Provenance d'une commande, déclarée par l'équipe. */
export async function setOrderCampaign(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "orders.write")) {
    return {
      status: "error",
      message: "Votre rôle ne permet pas cette action.",
    };
  }
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  const raw = String(formData.get("campaignId") ?? "");
  const campaignId = raw ? z.uuid().safeParse(raw) : null;
  if (!orderId.success || (campaignId && !campaignId.success)) return NETWORK;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_campaign", {
    p_order_id: orderId.data,
    p_campaign_id: campaignId?.data ?? null,
  });
  if (error) return rpcFailure(error);
  revalidatePath(`/dashboard/orders/${orderId.data}`);
  revalidatePath("/dashboard/campaigns");
  return { status: "success", message: "Provenance enregistrée." };
}
