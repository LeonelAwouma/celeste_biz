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

import { findCustomersByPhone } from "./queries";
import { CUSTOMER_FORM_FIELDS, customerSchema } from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Votre rôle ne permet pas de modifier les clients.",
};

const SAVE_FAILED: FormState = {
  status: "error",
  message:
    "Le client n'a pas été enregistré. Vérifiez votre connexion et réessayez.",
};

/** Création ou modification (même formulaire). */
export async function saveCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "customers.write")) return FORBIDDEN;

  const values = {
    ...keepValues(formData, CUSTOMER_FORM_FIELDS),
    marketingConsent: formData.get("marketingConsent") === "on" ? "on" : "",
  };
  const parsed = customerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);
  const input = parsed.data;
  const mode = formData.get("mode") === "edit" ? "edit" : "create";

  if (input.phone && !input.confirmDuplicate) {
    const duplicates = await findCustomersByPhone(
      business.id,
      input.phone,
      input.id,
    );
    if (duplicates.length) {
      return {
        status: "error",
        message: `Ce numéro est déjà utilisé par : ${duplicates.map((c) => c.name).join(", ")}. Vérifiez qu'il ne s'agit pas du même client, puis confirmez.`,
        values,
        data: { duplicate: "1" },
      };
    }
  }

  const row = {
    name: input.name,
    phone_e164: input.phone,
    email: input.email,
    notes: input.notes,
    marketing_consent: input.marketingConsent,
  };
  const supabase = await createClient();

  if (mode === "create") {
    const { error } = await supabase
      .from("customers")
      .insert({ id: input.id, business_id: business.id, ...row });
    // 23505 : même identifiant déjà enregistré (double envoi) → déjà créé.
    if (error && error.code !== "23505") return { ...SAVE_FAILED, values };
    revalidatePath("/dashboard/customers");
    redirect(`/dashboard/customers/${input.id}?enregistre=1`);
  }

  const { data, error } = await supabase
    .from("customers")
    .update(row)
    .eq("business_id", business.id)
    .eq("id", input.id)
    .select("id");
  if (error || !data?.length) return { ...SAVE_FAILED, values };

  revalidatePath("/dashboard/customers");
  return { status: "success", message: "Modifications enregistrées.", values };
}

export async function setCustomerArchived(formData: FormData): Promise<void> {
  const business = await requireActiveBusiness();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success || !can(business.role, "customers.archive")) {
    redirect("/dashboard/customers");
  }
  const archive = formData.get("archive") === "1";

  const supabase = await createClient();
  await supabase
    .from("customers")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("business_id", business.id)
    .eq("id", id.data);

  revalidatePath("/dashboard/customers");
  redirect(`/dashboard/customers/${id.data}`);
}
