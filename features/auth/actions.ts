"use server";

import { redirect } from "next/navigation";

import { getAppUrl } from "@/lib/env";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { createClient } from "@/lib/supabase/server";

import {
  resetRequestSchema,
  signInSchema,
  signUpSchema,
  keepValues,
  toFieldErrors,
  updatePasswordSchema,
  type FormState,
} from "./schemas";

const NETWORK_ERROR: FormState = {
  status: "error",
  message:
    "Le serveur n'a pas pu être joint. Vérifiez votre connexion et réessayez : rien n'a été enregistré.",
};

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        message:
          "Confirmez d'abord votre adresse avec le lien reçu par e-mail.",
        values,
      };
    }
    if (error.status === 429) {
      return {
        status: "error",
        message: "Trop de tentatives. Patientez quelques minutes.",
        values,
      };
    }
    if (!error.status || error.status >= 500) {
      return { ...NETWORK_ERROR, values };
    }
    // Message identique que l'adresse existe ou non (anti-énumération).
    return {
      status: "error",
      message: "E-mail ou mot de passe incorrect.",
      values,
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = keepValues(formData, ["displayName", "email"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${getAppUrl()}/auth/confirm`,
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return {
        status: "error",
        fieldErrors: {
          password: ["Mot de passe trop faible : ajoutez lettres et chiffres."],
        },
        values,
      };
    }
    if (error.status === 429) {
      return {
        status: "error",
        message: "Trop de demandes. Patientez quelques minutes.",
        values,
      };
    }
    if (!error.status || error.status >= 500) {
      return { ...NETWORK_ERROR, values };
    }
    return {
      status: "error",
      message: "L'inscription n'a pas abouti. Vérifiez vos informations.",
      values,
    };
  }

  // Même réponse si l'adresse est déjà inscrite (anti-énumération).
  return {
    status: "success",
    message: `Compte créé. Ouvrez le lien envoyé à ${parsed.data.email} pour confirmer votre adresse.`,
  };
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = keepValues(formData, ["email"]);
  const parsed = resetRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${getAppUrl()}/auth/confirm` },
  );

  if (error && (!error.status || error.status >= 500)) {
    return { ...NETWORK_ERROR, values };
  }

  return {
    status: "success",
    message:
      "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
  };
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "same_password") {
      return {
        status: "error",
        fieldErrors: {
          password: ["Choisissez un mot de passe différent de l'ancien."],
        },
      };
    }
    if (error.status === 401 || error.code === "session_not_found") {
      return {
        status: "error",
        message: "Lien expiré. Demandez un nouveau lien de réinitialisation.",
      };
    }
    return NETWORK_ERROR;
  }

  redirect("/dashboard/today");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
