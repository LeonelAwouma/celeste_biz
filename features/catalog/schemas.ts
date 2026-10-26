import { z } from "zod";

import { parseXafAmount } from "@/lib/monetary/xaf";

export const PRICE_MODES = ["fixed", "from", "quote"] as const;
export const ITEM_KINDS = ["service", "product"] as const;

export const PRICE_MODE_LABELS: Record<(typeof PRICE_MODES)[number], string> = {
  fixed: "Prix fixe",
  from: "À partir de",
  quote: "Sur devis",
};

export const ITEM_KIND_LABELS: Record<(typeof ITEM_KINDS)[number], string> = {
  service: "Service",
  product: "Produit",
};

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .optional()
    .transform((value) => value || null);

export const catalogItemSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(ITEM_KINDS, { error: "Choisissez service ou produit." }),
    name: z
      .string()
      .trim()
      .min(1, { error: "Indiquez un nom." })
      .max(120, { error: "Nom trop long (120 caractères maximum)." }),
    description: optionalText(
      500,
      "Description trop longue (500 caractères maximum).",
    ),
    category: optionalText(
      60,
      "Catégorie trop longue (60 caractères maximum).",
    ),
    priceMode: z.enum(PRICE_MODES, { error: "Choisissez un type de prix." }),
    price: z.string().optional(),
    unit: optionalText(30, "Unité trop longue (30 caractères maximum)."),
    visible: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
    position: z.coerce
      .number({ error: "Ordre invalide." })
      .int({ error: "Ordre invalide." })
      .min(0, { error: "Ordre invalide." })
      .max(100000, { error: "Ordre invalide." })
      .default(0),
  })
  .transform((value, ctx) => {
    if (value.priceMode === "quote") return { ...value, price: null };
    const price = parseXafAmount(value.price ?? "");
    if (price === null) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Indiquez un prix valide en FCFA (ex. 15 000).",
      });
      return z.NEVER;
    }
    return { ...value, price };
  });

export type CatalogItemInput = z.infer<typeof catalogItemSchema>;

export const CATALOG_FORM_FIELDS = [
  "id",
  "kind",
  "name",
  "description",
  "category",
  "priceMode",
  "price",
  "unit",
  "position",
] as const;

/** Images acceptées : vérification du type réel (signature du fichier). */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function detectImageType(
  bytes: Uint8Array,
): "jpg" | "png" | "webp" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  return null;
}

export const IMAGE_CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
