import { z } from "zod";

import { normalizePhoneE164 } from "@/lib/phone";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .optional()
    .transform((value) => value || null);

export const customerSchema = z.object({
  /** Identifiant généré par le formulaire : rend la création idempotente. */
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, { error: "Indiquez le nom ou un surnom du client." })
    .max(120, { error: "Nom trop long (120 caractères maximum)." }),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const normalized = normalizePhoneE164(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "Numéro invalide. Exemple : 6 77 12 34 56.",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((value) => value || null)
    .pipe(z.email({ error: "Adresse e-mail invalide." }).nullable()),
  notes: optionalText(2000, "Notes trop longues (2 000 caractères maximum)."),
  marketingConsent: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
  confirmDuplicate: z
    .literal("1")
    .optional()
    .transform((value) => value === "1"),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export const CUSTOMER_FORM_FIELDS = [
  "id",
  "name",
  "phone",
  "email",
  "notes",
] as const;
