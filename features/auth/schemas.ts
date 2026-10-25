import { z } from "zod";

const email = z
  .string({ error: "Indiquez votre adresse e-mail." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Adresse e-mail invalide." }));

/** Aligné sur supabase/config.toml : 8 caractères, lettres et chiffres. */
export const passwordSchema = z
  .string({ error: "Indiquez un mot de passe." })
  .min(8, { error: "Le mot de passe doit contenir au moins 8 caractères." })
  .max(72, { error: "Le mot de passe est trop long (72 caractères maximum)." })
  .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
    error: "Le mot de passe doit contenir au moins une lettre et un chiffre.",
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Indiquez votre mot de passe." }),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, { error: "Indiquez votre nom (2 caractères minimum)." })
    .max(120, { error: "Nom trop long." }),
  email,
  password: passwordSchema,
});

export const resetRequestSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    error: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valeurs saisies (jamais les mots de passe), réaffichées après erreur. */
  values?: Record<string, string>;
};

/** Champs non sensibles d'un formulaire, pour les réafficher après erreur. */
export function keepValues(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  return Object.fromEntries(
    fields.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

export const initialFormState: FormState = { status: "idle" };

export function toFieldErrors(
  error: z.ZodError,
  values?: Record<string, string>,
): FormState {
  return {
    status: "error",
    message: "Corrigez les champs indiqués.",
    values,
    fieldErrors: z.flattenError(error).fieldErrors as Record<
      string,
      string[] | undefined
    >,
  };
}
