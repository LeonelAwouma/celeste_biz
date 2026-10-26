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
import { buildOrderDetailsSchema } from "@/features/professions/order-details";
import { getProfessionTemplate } from "@/features/professions/registry";
import { can } from "@/lib/permissions/roles";
import {
  compareAmounts,
  computeLine,
  sumAmounts,
} from "@/lib/monetary/decimal";
import { createClient } from "@/lib/supabase/server";
import { todayLocal } from "@/lib/time";

import {
  ORDER_FORM_FIELDS,
  itemsToRpc,
  orderFormSchema,
  parseItemsJson,
  paymentSchema,
  readOrderDetails,
  transitionSchema,
  visibleOrderFields,
} from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Votre rôle ne permet pas cette action.",
};

const NETWORK: FormState = {
  status: "error",
  message: "Rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
};

/** Erreurs des fonctions SQL → message honnête pour l'utilisateur. */
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
          "La commande a été modifiée entre-temps par une autre personne. Rechargez la page pour voir la dernière version.",
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

function revalidateOrders(orderId?: string) {
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/today");
  if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
}

/** Création ou modification d'une commande (même formulaire). */
export async function saveOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getBusinessContext();
  const { business } = context;
  if (!can(business.role, "orders.write")) return FORBIDDEN;

  const values = keepValues(formData, ORDER_FORM_FIELDS);
  for (const [key, value] of formData) {
    if (key.startsWith("detail_")) values[key] = String(value);
  }
  values.asDraft = formData.get("asDraft") === "on" ? "on" : "";

  const mode = formData.get("mode") === "edit" ? "edit" : "create";
  const parsed = orderFormSchema.safeParse(Object.fromEntries(formData));
  const items = parseItemsJson(formData.get("items"));
  const supabase = await createClient();

  // Profil métier : celui de la commande en modification, sinon l'actuel.
  let template = context.template;
  let existingDetails: Record<string, unknown> = {};
  let version = 0;
  if (mode === "edit") {
    version = Number(formData.get("version"));
    const { data: existing } = await supabase
      .from("orders")
      .select("profession_key, profession_version, details")
      .eq("business_id", business.id)
      .eq("id", String(formData.get("id")))
      .maybeSingle();
    if (!existing) return { ...NETWORK, values };
    template = getProfessionTemplate(
      existing.profession_key,
      existing.profession_version,
    );
    existingDetails = (existing.details ?? {}) as Record<string, unknown>;
  }
  const fields = visibleOrderFields(template, context.modules);
  const details = buildOrderDetailsSchema({
    ...template,
    orderFields: fields,
  }).safeParse(readOrderDetails(formData, fields));

  if (!parsed.success || !items.success || !details.success) {
    const fieldErrors: Record<string, string[] | undefined> = {
      ...(parsed.success ? {} : toFieldErrors(parsed.error).fieldErrors),
    };
    if (!items.success) {
      fieldErrors.items = items.error.issues.map((issue) => {
        const line =
          typeof issue.path[0] === "number"
            ? `Ligne ${issue.path[0] + 1} : `
            : "";
        return `${line}${issue.message}`;
      });
    }
    if (!details.success) {
      for (const issue of details.error.issues) {
        const key = `detail_${String(issue.path[0])}`;
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
    }
    return {
      status: "error",
      message: "Corrigez les champs indiqués.",
      values,
      fieldErrors,
    };
  }
  const input = parsed.data;

  if (input.deposit) {
    const total = sumAmounts(
      items.data.map(
        (item) =>
          computeLine(
            item.quantity,
            item.unitPrice,
            item.discount,
            item.taxRate,
          ).total,
      ),
    );
    if (compareAmounts(input.deposit.amount, total) > 0) {
      return {
        status: "error",
        message: "Corrigez les champs indiqués.",
        values,
        fieldErrors: {
          depositAmount: ["L'acompte dépasse le total de la commande."],
        },
      };
    }
  }

  // Champs métier masqués (module désactivé depuis) : valeurs conservées.
  const hiddenKeys = template.orderFields
    .filter((f) => !fields.includes(f))
    .map((f) => f.key);
  const mergedDetails = {
    ...Object.fromEntries(
      hiddenKeys
        .filter((k) => k in existingDetails)
        .map((k) => [k, existingDetails[k]]),
    ),
    ...details.data,
  };

  let customerId = input.customerId;
  if (input.customerMode === "new") {
    // Fiche minimale ; identifiant généré par le formulaire (double envoi sans doublon).
    const { error } = await supabase.from("customers").insert({
      id: input.newCustomerId!,
      business_id: business.id,
      name: input.newCustomerName!,
      phone_e164: input.newCustomerPhone,
    });
    if (error && error.code !== "23505") return { ...NETWORK, values };
    customerId = input.newCustomerId;
  }

  if (mode === "create") {
    const { error } = await supabase.rpc("create_order", {
      p_id: input.id,
      p_business_id: business.id,
      p_customer_id: customerId!,
      p_items: itemsToRpc(items.data),
      p_status: input.asDraft ? "draft" : "confirmed",
      p_due_at: input.dueAt,
      p_assignee_id: input.assigneeId,
      p_notes: input.notes,
      p_details: mergedDetails,
    });
    if (error) return rpcFailure(error, values);

    if (input.deposit) {
      const { error: paymentError } = await supabase.rpc(
        "record_manual_payment",
        {
          p_id: input.deposit.id,
          p_order_id: input.id,
          p_method: input.deposit.method,
          p_amount: input.deposit.amount,
          p_paid_on: todayLocal(),
          p_reference: input.deposit.reference,
        },
      );
      if (paymentError) {
        revalidateOrders(input.id);
        // La commande existe : on l'ouvre en signalant que l'acompte manque.
        redirect(`/dashboard/orders/${input.id}?enregistre=1&acompte=echec`);
      }
    }
    revalidateOrders(input.id);
    redirect(`/dashboard/orders/${input.id}?enregistre=1`);
  }

  const { data: status } = await supabase
    .from("orders")
    .select("status")
    .eq("id", input.id)
    .maybeSingle();
  const lockedItems =
    status &&
    status.status !== "draft" &&
    status.status !== "pending_confirmation";
  const { error } = await supabase.rpc("update_order", {
    p_order_id: input.id,
    p_expected_version: version,
    p_customer_id: customerId!,
    p_due_at: input.dueAt,
    p_assignee_id: input.assigneeId,
    p_notes: input.notes,
    p_details: mergedDetails,
    p_production_step: input.productionStep,
    p_items: lockedItems ? null : itemsToRpc(items.data),
  });
  if (error) return rpcFailure(error, values);

  revalidateOrders(input.id);
  redirect(`/dashboard/orders/${input.id}?modifie=1`);
}

export async function transitionOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Le rôle exigé dépend de la transition : vérifié par la fonction SQL.
  await requireActiveBusiness();
  const parsed = transitionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Action invalide." };
  if (parsed.data.to === "cancelled" && !parsed.data.reason) {
    return {
      status: "error",
      message: "Indiquez le motif de l'annulation.",
      fieldErrors: { reason: ["Indiquez le motif de l'annulation."] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: parsed.data.orderId,
    p_expected_version: parsed.data.version,
    p_to_status: parsed.data.to,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcFailure(error);

  revalidateOrders(parsed.data.orderId);
  return { status: "success", message: "État mis à jour." };
}

export async function recordPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "orders.write")) return FORBIDDEN;
  const values = keepValues(formData, [
    "amount",
    "method",
    "paidOn",
    "reference",
    "note",
  ]);
  const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_manual_payment", {
    p_id: parsed.data.id,
    p_order_id: parsed.data.orderId,
    p_method: parsed.data.method,
    p_amount: parsed.data.amount,
    p_paid_on: parsed.data.paidOn,
    p_reference: parsed.data.reference,
    p_note: parsed.data.note,
  });
  if (error) return rpcFailure(error, values);

  revalidateOrders(parsed.data.orderId);
  return {
    status: "success",
    message: "Encaissement enregistré (déclaré manuellement).",
  };
}

export async function cancelPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "payments.cancel")) return FORBIDDEN;
  const id = z.uuid().safeParse(formData.get("paymentId"));
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id.success || !orderId.success)
    return { status: "error", message: "Action invalide." };
  if (!reason) {
    return {
      status: "error",
      message: "Indiquez le motif de l'annulation.",
      fieldErrors: { reason: ["Indiquez le motif de l'annulation."] },
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_payment", {
    p_payment_id: id.data,
    p_reason: reason.slice(0, 500),
  });
  if (error) return rpcFailure(error);

  revalidateOrders(orderId.data);
  return {
    status: "success",
    message: "Encaissement annulé. Il reste visible dans l'historique.",
  };
}

/** Recherche de clients pour le sélecteur de la commande (10 au plus). */
export async function findCustomersForOrder(
  query: string,
): Promise<{ id: string; name: string; phone: string | null }[]> {
  const business = await requireActiveBusiness();
  const supabase = await createClient();
  const { data } = await supabase.rpc("search_customers", {
    p_business_id: business.id,
    p_query: query.slice(0, 100) || null,
    p_archived: false,
    p_limit: 10,
  });
  return (
    (data ?? []) as { id: string; name: string; phone_e164: string | null }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone_e164,
  }));
}
