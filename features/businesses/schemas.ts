import { z } from "zod";

import { PROFESSION_KEYS } from "@/features/professions/registry";
import { OPTIONAL_MODULES } from "@/features/professions/schema";
import { normalizePhoneE164 } from "@/lib/phone";

const name = z
  .string()
  .trim()
  .min(2, {
    error: "Indiquez le nom de votre entreprise (2 caractères minimum).",
  })
  .max(120, { error: "Nom trop long (120 caractères maximum)." });

const city = z
  .string()
  .trim()
  .max(80, { error: "Nom de ville trop long." })
  .optional()
  .transform((value) => value || undefined);

/** Numéro WhatsApp facultatif, normalisé en E.164 (+237…). */
const whatsappPhone = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const normalized = normalizePhoneE164(value);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message:
          "Numéro invalide. Exemple : 6 77 12 34 56 ou +237 677 12 34 56.",
      });
      return z.NEVER;
    }
    return normalized;
  });

const professionKey = z.enum(PROFESSION_KEYS, {
  error: "Choisissez votre métier.",
});

export const createBusinessSchema = z.object({
  name,
  professionKey,
  city,
  whatsappPhone,
});

export const updateBusinessSchema = z.object({ name, city, whatsappPhone });

export const updateProfessionSchema = z.object({ professionKey });

/** Cases à cocher : présente = activé, absente = désactivé. */
export function parseModuleForm(
  formData: FormData,
  available: readonly (typeof OPTIONAL_MODULES)[number][],
) {
  return Object.fromEntries(
    available.map((module) => [
      module,
      formData.get(`module_${module}`) === "on",
    ]),
  );
}

export const INVITABLE_ROLES = ["manager", "staff", "viewer"] as const;

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Adresse e-mail invalide." })),
  role: z.enum(INVITABLE_ROLES, { error: "Choisissez un rôle." }),
});

export const memberRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(["owner", ...INVITABLE_ROLES]),
});

export const businessIdSchema = z.uuid();

/** Jeton d'invitation : 32 octets en base64url (43 caractères). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
