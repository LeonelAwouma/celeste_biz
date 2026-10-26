import { z } from "zod";

import type {
  ModuleKey,
  OrderField,
  ProfessionTemplate,
} from "@/features/professions/schema";
import { parseDecimal } from "@/lib/monetary/decimal";
import { parseXafAmount } from "@/lib/monetary/xaf";
import { normalizePhoneE164 } from "@/lib/phone";
import { localDateTimeToIso } from "@/lib/time";

import { PAYMENT_METHODS } from "./status";

const amount = (message: string) =>
  z.string({ error: message }).transform((value, ctx) => {
    const parsed = parseXafAmount(value);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return parsed;
  });

const optionalAmount = (message: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return "0.00";
      const parsed = parseXafAmount(value);
      if (parsed === null) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return parsed;
    });

/** Ligne de commande telle que saisie (chaînes), normalisée pour la base. */
export const orderItemSchema = z
  .object({
    catalogItemId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((value) => value || null),
    name: z
      .string({ error: "Indiquez le libellé de la ligne." })
      .trim()
      .min(1, { error: "Indiquez le libellé de la ligne." })
      .max(200, { error: "Libellé trop long (200 caractères maximum)." }),
    unit: z
      .string()
      .trim()
      .max(30, { error: "Unité trop longue." })
      .optional()
      .transform((value) => value || null),
    quantity: z
      .string({ error: "Quantité invalide." })
      .transform((value, ctx) => {
        const parsed = parseDecimal(value, 3);
        if (parsed === null || Number(parsed) <= 0 || Number(parsed) > 100000) {
          ctx.addIssue({
            code: "custom",
            message: "Quantité invalide (ex. 1 ou 1,5).",
          });
          return z.NEVER;
        }
        return parsed;
      }),
    unitPrice: amount("Prix invalide (ex. 15 000)."),
    discount: optionalAmount("Remise invalide."),
    taxRate: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value?.trim()) return "0";
        const parsed = parseDecimal(value.replace("%", ""), 2);
        if (parsed === null || Number(parsed) > 100) {
          ctx.addIssue({
            code: "custom",
            message: "Taux de taxe invalide (0 à 100 %).",
          });
          return z.NEVER;
        }
        return parsed;
      }),
  })
  .superRefine((item, ctx) => {
    // Remise ≤ montant de la ligne : contrôle exact fait en base ; ici un
    // garde-fou lisible sur les cas courants (montants entiers).
    if (
      Number(item.discount) >
      Number(item.quantity) * Number(item.unitPrice)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["discount"],
        message: "La remise dépasse le montant de la ligne.",
      });
    }
  });

export type OrderItemInput = z.infer<typeof orderItemSchema>;

export const orderItemsSchema = z
  .array(orderItemSchema)
  .min(1, { error: "Ajoutez au moins une ligne à la commande." })
  .max(100, { error: "100 lignes au maximum par commande." });

/** Lignes envoyées sous forme JSON par le formulaire. */
export function parseItemsJson(raw: FormDataEntryValue | null) {
  let value: unknown;
  try {
    value = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    value = [];
  }
  return orderItemsSchema.safeParse(value);
}

/** Format attendu par la fonction SQL (`replace_order_items`). */
export function itemsToRpc(items: OrderItemInput[]) {
  return items.map((item) => ({
    catalog_item_id: item.catalogItemId,
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    discount: item.discount,
    tax_rate: item.taxRate,
  }));
}

const optionalUuid = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((value) => value || null);

export const orderFormSchema = z
  .object({
    id: z.uuid(),
    customerMode: z.enum(["existing", "new"]),
    customerId: optionalUuid,
    newCustomerId: optionalUuid,
    newCustomerName: z
      .string()
      .trim()
      .max(120, { error: "Nom trop long (120 caractères maximum)." })
      .optional(),
    newCustomerPhone: z
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
    asDraft: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
    dueDate: z.string().optional(),
    dueTime: z.string().optional(),
    assigneeId: optionalUuid,
    notes: z
      .string()
      .trim()
      .max(2000, { error: "Notes trop longues (2 000 caractères maximum)." })
      .optional()
      .transform((value) => value || null),
    productionStep: z
      .string()
      .regex(/^([a-z][a-z0-9_]*)?$/)
      .optional()
      .transform((value) => value || null),
    depositAmount: z.string().optional(),
    depositMethod: z.enum(PAYMENT_METHODS).optional(),
    depositReference: z
      .string()
      .trim()
      .max(100, { error: "Référence trop longue." })
      .optional()
      .transform((value) => value || null),
    depositId: optionalUuid,
  })
  .transform((value, ctx) => {
    if (value.customerMode === "existing" && !value.customerId) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Choisissez un client.",
      });
    }
    if (
      value.customerMode === "new" &&
      (!value.newCustomerName || !value.newCustomerId)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["newCustomerName"],
        message: "Indiquez le nom ou un surnom du client.",
      });
    }

    let dueAt: string | null = null;
    if (value.dueDate) {
      dueAt = localDateTimeToIso(value.dueDate, value.dueTime ?? "");
      if (!dueAt)
        ctx.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "Date invalide.",
        });
    } else if (value.dueTime) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Indiquez aussi la date.",
      });
    }

    let deposit: {
      id: string;
      amount: string;
      method: (typeof PAYMENT_METHODS)[number];
      reference: string | null;
    } | null = null;
    if (value.depositAmount?.trim()) {
      const parsed = parseXafAmount(value.depositAmount);
      if (!parsed || Number(parsed) <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["depositAmount"],
          message: "Montant invalide (ex. 10 000).",
        });
      } else if (!value.depositMethod || !value.depositId) {
        ctx.addIssue({
          code: "custom",
          path: ["depositMethod"],
          message: "Choisissez le moyen de paiement.",
        });
      } else {
        deposit = {
          id: value.depositId,
          amount: parsed,
          method: value.depositMethod,
          reference: value.depositReference,
        };
      }
    }

    return { ...value, dueAt, deposit };
  });

export type OrderFormInput = z.infer<typeof orderFormSchema>;

export const ORDER_FORM_FIELDS = [
  "customerMode",
  "customerId",
  "newCustomerName",
  "newCustomerPhone",
  "dueDate",
  "dueTime",
  "assigneeId",
  "notes",
  "productionStep",
  "depositAmount",
  "depositMethod",
  "depositReference",
  "items",
] as const;

/** Champs métier affichés : un champ « mesures » suit le module Mesures. */
export function visibleOrderFields(
  template: ProfessionTemplate,
  modules: ReadonlySet<ModuleKey>,
): OrderField[] {
  return template.orderFields.filter(
    (field) => field.type !== "measurements" || modules.has("measurements"),
  );
}

export const detailInputName = (key: string, point?: string) =>
  point ? `detail_${key}__${point}` : `detail_${key}`;

/** Reconstitue l'objet des informations métier à partir du formulaire. */
export function readOrderDetails(
  formData: FormData,
  fields: readonly OrderField[],
) {
  return Object.fromEntries(
    fields.map((field) => {
      if (field.type === "measurements") {
        return [
          field.key,
          Object.fromEntries(
            field.points.map((point) => [
              point.key,
              String(formData.get(detailInputName(field.key, point.key)) ?? ""),
            ]),
          ),
        ];
      }
      return [
        field.key,
        String(formData.get(detailInputName(field.key)) ?? ""),
      ];
    }),
  );
}

export const paymentSchema = z.object({
  id: z.uuid(),
  orderId: z.uuid(),
  amount: amount("Montant invalide (ex. 10 000)."),
  method: z.enum(PAYMENT_METHODS, {
    error: "Choisissez le moyen de paiement.",
  }),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date invalide." }),
  reference: z
    .string()
    .trim()
    .max(100, { error: "Référence trop longue." })
    .optional()
    .transform((value) => value || null),
  note: z
    .string()
    .trim()
    .max(500, { error: "Note trop longue." })
    .optional()
    .transform((value) => value || null),
});

export const transitionSchema = z.object({
  orderId: z.uuid(),
  version: z.coerce.number().int().positive(),
  to: z.enum([
    "draft",
    "pending_confirmation",
    "confirmed",
    "in_progress",
    "ready",
    "delivered",
    "closed",
    "cancelled",
    "disputed",
  ]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
});
