import { z } from "zod";

/**
 * Modules fonctionnels. Les modules « cœur » sont toujours actifs ; les
 * autres peuvent être activés ou désactivés par l'entreprise.
 */
export const CORE_MODULES = [
  "orders",
  "customers",
  "catalog",
  "payments",
  "invoices",
] as const;

export const OPTIONAL_MODULES = [
  "quotes",
  "website",
  "measurements",
  "events",
] as const;

export const MODULE_KEYS = [...CORE_MODULES, ...OPTIONAL_MODULES] as const;

export type CoreModule = (typeof CORE_MODULES)[number];
export type OptionalModule = (typeof OPTIONAL_MODULES)[number];
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** États génériques d'une commande (§5.5), validés côté serveur. */
export const ORDER_STATES = [
  "draft",
  "pending_confirmation",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
  "closed",
  "cancelled",
  "disputed",
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

const key = z.string().regex(/^[a-z][a-z0-9_]*$/);
const label = z.string().min(1).max(80);

const fieldBase = {
  key,
  label,
  help: z.string().max(200).optional(),
  required: z.boolean().default(false),
  /** Donnée interne : jamais affichée au client final ni sur un document. */
  private: z.boolean().default(false),
};

export const orderFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...fieldBase,
    type: z.literal("text"),
    maxLength: z.number().int().positive().default(200),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("textarea"),
    maxLength: z.number().int().positive().default(2000),
  }),
  z.object({ ...fieldBase, type: z.literal("date") }),
  z.object({ ...fieldBase, type: z.literal("datetime") }),
  z.object({
    ...fieldBase,
    type: z.literal("number"),
    min: z.number().default(0),
    max: z.number().optional(),
    integer: z.boolean().default(false),
    unit: z.string().max(20).optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("select"),
    options: z.array(z.object({ value: key, label })).min(2),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("measurements"),
    unit: z.literal("cm"),
    points: z.array(z.object({ key, label })).min(1),
  }),
]);

export type OrderField = z.infer<typeof orderFieldSchema>;

export const professionTemplateSchema = z
  .object({
    key,
    version: z.number().int().positive(),
    label,
    description: z.string().max(300),
    /** Libellés métier affichés dans l'interface. */
    labels: z.object({
      catalog: label,
      catalogItem: label,
      order: label,
      orders: label,
    }),
    /** Modules facultatifs activés par défaut pour ce métier. */
    defaultModules: z.array(z.enum(OPTIONAL_MODULES)),
    /** Modules facultatifs proposés (les autres restent masqués). */
    availableModules: z.array(z.enum(OPTIONAL_MODULES)),
    orderFields: z.array(orderFieldSchema),
    /** Libellés d'états propres au métier (sinon libellés génériques). */
    stateLabels: z.partialRecord(z.enum(ORDER_STATES), label).default({}),
    /** Étapes internes de réalisation pendant l'état `in_progress`. */
    productionSteps: z.array(z.object({ key, label })),
  })
  .superRefine((template, ctx) => {
    for (const moduleKey of template.defaultModules) {
      if (!template.availableModules.includes(moduleKey)) {
        ctx.addIssue({
          code: "custom",
          message: `module par défaut non proposé : ${moduleKey}`,
          path: ["defaultModules"],
        });
      }
    }
    const fieldKeys = template.orderFields.map((field) => field.key);
    if (new Set(fieldKeys).size !== fieldKeys.length) {
      ctx.addIssue({
        code: "custom",
        message: "clés de champs en double",
        path: ["orderFields"],
      });
    }
  });

export type ProfessionTemplate = z.infer<typeof professionTemplateSchema>;
export type ProfessionTemplateInput = z.input<typeof professionTemplateSchema>;
