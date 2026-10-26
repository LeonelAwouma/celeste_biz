"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { FormState } from "@/features/auth/schemas";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { getAppUrl } from "@/lib/env";
import { can } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Votre rôle ne permet pas cette action.",
};

const createSchema = z.object({
  orderId: z.uuid(),
  days: z.coerce.number().int().min(1).max(365),
  showAmounts: z
    .literal("on")
    .optional()
    .transform((v) => v === "on"),
  showDocuments: z
    .literal("on")
    .optional()
    .transform((v) => v === "on"),
});

/** Crée le lien de suivi ; il n'est affiché qu'une fois (jeton haché en base). */
export async function createTrackingLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "orders.write")) return FORBIDDEN;
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Action invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_tracking_link", {
    p_order_id: parsed.data.orderId,
    p_days: parsed.data.days,
    p_show_amounts: parsed.data.showAmounts,
    p_show_documents: parsed.data.showDocuments,
  });
  if (error) {
    return error.code === "CB422"
      ? { status: "error", message: error.message }
      : error.code === "42501"
        ? FORBIDDEN
        : {
            status: "error",
            message: "Le lien n'a pas été créé. Vérifiez votre connexion.",
          };
  }

  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);
  return {
    status: "success",
    message:
      "Lien créé. Copiez-le maintenant : il ne sera plus affiché ensuite.",
    data: { link: `${getAppUrl()}/suivi/${data as string}` },
  };
}

export async function revokeTrackingLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "orders.write")) return FORBIDDEN;
  const id = z.uuid().safeParse(formData.get("linkId"));
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success || !orderId.success)
    return { status: "error", message: "Action invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_tracking_link", {
    p_link_id: id.data,
  });
  if (error)
    return error.code === "42501"
      ? FORBIDDEN
      : { status: "error", message: "La révocation a échoué. Réessayez." };

  revalidatePath(`/dashboard/orders/${orderId.data}`);
  return {
    status: "success",
    message: "Lien révoqué : le client ne peut plus consulter le suivi.",
  };
}
