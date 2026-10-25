import { z } from "zod";

import type { OrderField, ProfessionTemplate } from "./schema";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Champ vide (formulaire HTML, espaces seuls) → absent. */
const emptyToUndefined = (value: unknown) =>
  value === null || (typeof value === "string" && value.trim() === "")
    ? undefined
    : value;

function isRealDate(value: string) {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function fieldSchema(field: OrderField): z.ZodType {
  const required = `« ${field.label} » est obligatoire.`;
  /** Message « obligatoire » si absent, sinon le message de format. */
  const invalid = (message: string) => (issue: { input?: unknown }) =>
    issue.input === undefined ? required : message;
  let schema: z.ZodType;

  switch (field.type) {
    case "text":
    case "textarea":
      schema = z
        .string({ error: invalid(`« ${field.label} » : texte attendu.`) })
        .trim()
        .max(field.maxLength, {
          error: `« ${field.label} » : ${field.maxLength} caractères maximum.`,
        })
        .transform((value) => value || undefined);
      break;
    case "date":
      schema = z
        .string({ error: invalid(`« ${field.label} » : date invalide.`) })
        .regex(DATE, { error: `« ${field.label} » : date invalide.` })
        .refine(isRealDate, { error: `« ${field.label} » : date invalide.` });
      break;
    case "datetime":
      // Saisie locale (fuseau de l'entreprise, Africa/Douala par défaut).
      schema = z
        .string({
          error: invalid(`« ${field.label} » : date et heure invalides.`),
        })
        .regex(DATETIME, {
          error: `« ${field.label} » : date et heure invalides.`,
        })
        .refine(isRealDate, { error: `« ${field.label} » : date invalide.` });
      break;
    case "number": {
      let number = z.coerce.number({
        error: invalid(`« ${field.label} » : nombre invalide.`),
      });
      number = number.min(field.min, {
        error: `« ${field.label} » : ${field.min} minimum.`,
      });
      if (field.max !== undefined) {
        number = number.max(field.max, {
          error: `« ${field.label} » : ${field.max} maximum.`,
        });
      }
      schema = field.integer
        ? number.int({ error: `« ${field.label} » : nombre entier attendu.` })
        : number;
      break;
    }
    case "select":
      schema = z.enum(
        field.options.map((option) => option.value) as [string, ...string[]],
        { error: invalid(`« ${field.label} » : choix invalide.`) },
      );
      break;
    case "measurements": {
      const point = z.preprocess(
        emptyToUndefined,
        z.coerce
          .number({ error: "Mesure invalide." })
          .positive({ error: "Mesure invalide." })
          .max(300, { error: "Mesure trop grande (300 cm maximum)." })
          .optional(),
      );
      schema = z
        .object(Object.fromEntries(field.points.map((p) => [p.key, point])))
        .strict()
        .transform((values) => {
          const filled = Object.fromEntries(
            Object.entries(values).filter(([, v]) => v !== undefined),
          );
          return Object.keys(filled).length ? filled : undefined;
        });
      break;
    }
  }

  // Un champ obligatoire n'accepte pas `undefined` : la clé est exigée.
  return field.required
    ? z.preprocess(emptyToUndefined, schema)
    : z.preprocess(emptyToUndefined, schema.optional());
}

/**
 * Schéma de validation serveur des informations métier d'une commande,
 * construit à partir du profil métier. Les clés inconnues sont refusées.
 */
export function buildOrderDetailsSchema(template: ProfessionTemplate) {
  return z
    .object(
      Object.fromEntries(
        template.orderFields.map((field) => [field.key, fieldSchema(field)]),
      ),
    )
    .strict()
    .transform((values) =>
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
      ),
    );
}

/** Informations montrables au client final : sans les champs privés. */
export function publicOrderDetails(
  template: ProfessionTemplate,
  details: Record<string, unknown>,
): Record<string, unknown> {
  const publicKeys = new Set(
    template.orderFields.filter((f) => !f.private).map((f) => f.key),
  );
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => publicKeys.has(key)),
  );
}
