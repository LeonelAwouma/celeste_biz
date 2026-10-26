import { z } from "zod";

import { parseXafAmount } from "@/lib/monetary/xaf";

export const INVOICE_STATUS_LABELS = {
  draft: "Brouillon",
  issued: "Émise",
  discarded: "Abandonné",
} as const;
export type InvoiceStatus = keyof typeof INVOICE_STATUS_LABELS;

export const ISSUE_DISABLED_MESSAGE =
  "L'émission définitive des factures est désactivée tant que la conformité fiscale n'est pas validée. Le brouillon reste disponible.";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` })
    .optional()
    .transform((value) => value || undefined);

/**
 * Profil de facturation du vendeur. Les identifiants (NIU, RCCM) sont
 * saisis par le commerçant ; Céleste Biz ne les vérifie pas.
 */
export const fiscalProfileSchema = z.object({
  legal_name: text(200),
  niu: text(200),
  rccm: text(200),
  tax_regime: text(200),
  address: text(200),
  phone: text(200),
  email: z
    .union([z.email({ error: "Adresse e-mail invalide." }), z.literal("")])
    .optional()
    .transform((value) => value || undefined),
  invoice_mentions: text(1000),
});

export type FiscalProfile = Partial<z.infer<typeof fiscalProfileSchema>>;

export const FISCAL_PROFILE_FIELDS = [
  "legal_name",
  "niu",
  "rccm",
  "tax_regime",
  "address",
  "phone",
  "email",
  "invoice_mentions",
] as const;

/** Profil stocké (jsonb) → valeurs texte sûres. */
export function readFiscalProfile(value: unknown): FiscalProfile {
  const parsed = fiscalProfileSchema.safeParse(
    value && typeof value === "object" ? value : {},
  );
  return parsed.success ? parsed.data : {};
}

/** Profil sans les clés vides (format attendu par `update_fiscal_profile`). */
export function compactProfile(profile: FiscalProfile) {
  return Object.fromEntries(
    Object.entries(profile).filter(([, value]) => Boolean(value)),
  ) as Record<string, string>;
}

const date = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." }),
    z.literal(""),
  ])
  .optional()
  .transform((value) => value || null);

export const invoiceDraftSchema = z.object({
  invoiceId: z.uuid(),
  version: z.coerce.number().int().positive(),
  dueDate: date,
  conditions: z
    .string()
    .trim()
    .max(2000, { error: "Conditions trop longues (2 000 caractères maximum)." })
    .optional()
    .transform((value) => value || null),
  refreshItems: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
});

export const creditNoteSchema = z.object({
  id: z.uuid(),
  invoiceId: z.uuid(),
  amount: z.string({ error: "Montant invalide." }).transform((value, ctx) => {
    const parsed = parseXafAmount(value);
    if (parsed === null || Number(parsed) <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Montant invalide (ex. 5 000).",
      });
      return z.NEVER;
    }
    return parsed;
  }),
  reason: z
    .string({ error: "Indiquez le motif de l'avoir." })
    .trim()
    .min(1, { error: "Indiquez le motif de l'avoir." })
    .max(500, { error: "Motif trop long (500 caractères maximum)." }),
});
