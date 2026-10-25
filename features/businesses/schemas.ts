import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, {
      error: "Indiquez le nom de votre entreprise (2 caractères minimum).",
    })
    .max(120, { error: "Nom trop long (120 caractères maximum)." }),
  city: z
    .string()
    .trim()
    .max(80, { error: "Nom de ville trop long." })
    .optional()
    .transform((value) => value || undefined),
});

export const businessIdSchema = z.uuid();
