"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { ACTIVE_BUSINESS_COOKIE, listMyBusinesses } from "./active-business";
import { businessIdSchema, createBusinessSchema } from "./schemas";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function rememberActiveBusiness(businessId: string) {
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function createBusiness(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const values = keepValues(formData, ["name", "city"]);
  const parsed = createBusinessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  // La fonction SQL crée l'entreprise, l'adhésion « owner » et l'audit
  // dans une seule transaction.
  const { data, error } = await supabase
    .rpc("create_business", {
      p_name: parsed.data.name,
      p_city: parsed.data.city ?? null,
    })
    .single<{ id: string }>();

  if (error || !data) {
    if (error?.code === "54000") {
      return {
        status: "error",
        message: "Vous avez atteint le nombre maximal d'entreprises.",
        values,
      };
    }
    return {
      status: "error",
      message:
        "L'entreprise n'a pas été créée. Vérifiez votre connexion et réessayez.",
    };
  }

  await rememberActiveBusiness(data.id);
  redirect("/dashboard/today");
}

export async function setActiveBusiness(formData: FormData): Promise<void> {
  const parsed = businessIdSchema.safeParse(formData.get("businessId"));
  if (!parsed.success) redirect("/dashboard/today");

  // L'ID reçu n'est qu'un choix : il doit correspondre à une adhésion active.
  const businesses = await listMyBusinesses();
  if (businesses.some((business) => business.id === parsed.data)) {
    await rememberActiveBusiness(parsed.data);
  }
  redirect("/dashboard/today");
}
