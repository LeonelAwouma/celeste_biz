import { z } from "zod";

import { QUOTE_STATUSES } from "./status";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .optional()
    .transform((value) => value || null);

/** En-tête du devis ; les lignes passent par `parseItemsJson` (commandes). */
export const quoteFormSchema = z.object({
  id: z.uuid(),
  customerMode: z.enum(["existing", "new"]),
  customerId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => value || null),
  newCustomerId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((value) => value || null),
  newCustomerName: z
    .string()
    .trim()
    .max(120, { error: "Nom trop long (120 caractères maximum)." })
    .optional(),
  newCustomerPhone: z.string().trim().optional(),
  validUntil: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." }),
      z.literal(""),
    ])
    .optional()
    .transform((value) => value || null),
  conditions: optionalText(
    2000,
    "Conditions trop longues (2 000 caractères maximum).",
  ),
  notes: optionalText(2000, "Notes trop longues (2 000 caractères maximum)."),
});

export const QUOTE_FORM_FIELDS = [
  "customerMode",
  "customerId",
  "newCustomerName",
  "newCustomerPhone",
  "validUntil",
  "conditions",
  "notes",
  "items",
] as const;

export const quoteTransitionSchema = z.object({
  quoteId: z.uuid(),
  version: z.coerce.number().int().positive(),
  to: z.enum(QUOTE_STATUSES),
  note: optionalText(500, "Note trop longue (500 caractères maximum)."),
});
