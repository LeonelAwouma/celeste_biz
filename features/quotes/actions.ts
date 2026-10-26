"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import {
  getBusinessContext,
  requireActiveBusiness,
} from "@/features/businesses/active-business";
import { itemsToRpc, parseItemsJson } from "@/features/orders/schemas";
import { can } from "@/lib/permissions/roles";
import { normalizePhoneE164 } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { localDateTimeToIso } from "@/lib/time";

import {
  QUOTE_FORM_FIELDS,
  quoteFormSchema,
  quoteTransitionSchema,
} from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Votre rôle ne permet pas cette action.",
};

const NETWORK: FormState = {
  status: "error",
  message: "Rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
};

function rpcFailure(
  error: { code?: string; message: string },
  values?: Record<string, string>,
): FormState {
  switch (error.code) {
    case "CB422":
      return { status: "error", message: error.message, values };
    case "CB409":
      return {
        status: "error",
        message:
          "Le devis a été modifié entre-temps par une autre personne. Rechargez la page pour voir la dernière version.",
        values,
      };
    case "42501":
      return { ...FORBIDDEN, values };
    case "23514":
      return {
        status: "error",
        message:
          "Un montant est incohérent (remise ou total). Vérifiez les lignes.",
        values,
      };
    default:
      return { ...NETWORK, values };
  }
}

function revalidateQuotes(quoteId?: string) {
  revalidatePath("/dashboard/quotes");
  if (quoteId) revalidatePath(`/dashboard/quotes/${quoteId}`);
}

async function quotesEnabled() {
  const context = await getBusinessContext();
  return { context, enabled: context.modules.has("quotes") };
}

/** Création ou modification d'un devis en brouillon. */
export async function saveQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { context, enabled } = await quotesEnabled();
  const { business } = context;
  if (!can(business.role, "orders.write")) return FORBIDDEN;
  if (!enabled) {
    return { status: "error", message: "Le module Devis est désactivé." };
  }

  const values = keepValues(formData, QUOTE_FORM_FIELDS);
  const mode = formData.get("mode") === "edit" ? "edit" : "create";
  const parsed = quoteFormSchema.safeParse(Object.fromEntries(formData));
  const items = parseItemsJson(formData.get("items"));

  const fieldErrors: Record<string, string[] | undefined> = parsed.success
    ? {}
    : { ...toFieldErrors(parsed.error).fieldErrors };
  if (!items.success) {
    fieldErrors.items = items.error.issues.map((issue) => {
      const line =
        typeof issue.path[0] === "number"
          ? `Ligne ${issue.path[0] + 1} : `
          : "";
      return `${line}${issue.message.replace("à la commande", "au devis")}`;
    });
  }
  let newPhone: string | null = null;
  if (parsed.success) {
    const input = parsed.data;
    if (input.customerMode === "existing" && !input.customerId) {
      fieldErrors.customerId = ["Choisissez un client."];
    }
    if (input.customerMode === "new") {
      if (!input.newCustomerName || !input.newCustomerId) {
        fieldErrors.newCustomerName = [
          "Indiquez le nom ou un surnom du client.",
        ];
      }
      if (input.newCustomerPhone) {
        newPhone = normalizePhoneE164(input.newCustomerPhone);
        if (!newPhone) {
          fieldErrors.newCustomerPhone = [
            "Numéro invalide. Exemple : 6 77 12 34 56.",
          ];
        }
      }
    }
  }
  if (!parsed.success || !items.success || Object.keys(fieldErrors).length) {
    return {
      status: "error",
      message: "Corrigez les champs indiqués.",
      values,
      fieldErrors,
    };
  }
  const input = parsed.data;
  const supabase = await createClient();

  let customerId = input.customerId;
  if (input.customerMode === "new") {
    const { error } = await supabase.from("customers").insert({
      id: input.newCustomerId!,
      business_id: business.id,
      name: input.newCustomerName!,
      phone_e164: newPhone,
    });
    if (error && error.code !== "23505") return { ...NETWORK, values };
    customerId = input.newCustomerId;
  }

  if (mode === "create") {
    const { error } = await supabase.rpc("create_quote", {
      p_id: input.id,
      p_business_id: business.id,
      p_customer_id: customerId!,
      p_items: itemsToRpc(items.data),
      p_valid_until: input.validUntil,
      p_conditions: input.conditions,
      p_notes: input.notes,
    });
    if (error) return rpcFailure(error, values);
    revalidateQuotes(input.id);
    redirect(`/dashboard/quotes/${input.id}?enregistre=1`);
  }

  const { error } = await supabase.rpc("update_quote", {
    p_quote_id: input.id,
    p_expected_version: Number(formData.get("version")),
    p_customer_id: customerId!,
    p_items: itemsToRpc(items.data),
    p_valid_until: input.validUntil,
    p_conditions: input.conditions,
    p_notes: input.notes,
  });
  if (error) return rpcFailure(error, values);
  revalidateQuotes(input.id);
  redirect(`/dashboard/quotes/${input.id}?modifie=1`);
}

export async function transitionQuote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Le rôle exigé dépend de la transition : vérifié par la fonction SQL.
  await requireActiveBusiness();
  const parsed = quoteTransitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Action invalide." };
  if (parsed.data.to === "cancelled" && !parsed.data.note) {
    return {
      status: "error",
      message: "Indiquez le motif de l'annulation.",
      fieldErrors: { note: ["Indiquez le motif de l'annulation."] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_quote", {
    p_quote_id: parsed.data.quoteId,
    p_expected_version: parsed.data.version,
    p_to_status: parsed.data.to,
    p_note: parsed.data.note,
  });
  if (error) return rpcFailure(error);

  revalidateQuotes(parsed.data.quoteId);
  return { status: "success", message: "Devis mis à jour." };
}

const convertSchema = z.object({
  quoteId: z.uuid(),
  orderId: z.uuid(),
  dueDate: z.string().optional(),
});

/** Devis accepté → commande confirmée (lignes figées, idempotent). */
export async function convertQuoteToOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "orders.write")) return FORBIDDEN;
  const parsed = convertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Action invalide." };
  const values = { dueDate: parsed.data.dueDate ?? "" };
  let dueAt: string | null = null;
  if (parsed.data.dueDate) {
    dueAt = localDateTimeToIso(parsed.data.dueDate);
    if (!dueAt) {
      return {
        status: "error",
        message: "Corrigez les champs indiqués.",
        values,
        fieldErrors: { dueDate: ["Date invalide."] },
      };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_quote_to_order", {
    p_quote_id: parsed.data.quoteId,
    p_order_id: parsed.data.orderId,
    p_due_at: dueAt,
  });
  if (error) return rpcFailure(error, values);

  revalidateQuotes(parsed.data.quoteId);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/today");
  redirect(`/dashboard/orders/${(data as { id: string }).id}?depuis_devis=1`);
}
