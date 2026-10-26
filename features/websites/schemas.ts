import { z } from "zod";

import {
  SITE_ACCENTS,
  SITE_TEMPLATE_KEYS,
  isSiteAccent,
  type SiteAccent,
} from "./templates";

/** Adresses refusées par la base (même liste que `private.reserved_site_slug`). */
export const RESERVED_SITE_SLUGS = [
  "admin",
  "api",
  "app",
  "aide",
  "auth",
  "celeste",
  "celestebiz",
  "celeste-biz",
  "compte",
  "dashboard",
  "help",
  "login",
  "officiel",
  "paiement",
  "sites",
  "suivi",
  "support",
  "www",
];

export const SITE_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} : ${max} caractères au maximum.` })
    .transform((value) => value || null);

export const siteFormSchema = z.object({
  version: z.coerce.number().int().positive(),
  templateKey: z.enum(SITE_TEMPLATE_KEYS, { error: "Choisissez un modèle." }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { error: "3 caractères au minimum." })
    .max(60, { error: "60 caractères au maximum." })
    .regex(SITE_SLUG_PATTERN, {
      error: "Lettres minuscules sans accents, chiffres et tirets uniquement.",
    })
    .refine((value) => !RESERVED_SITE_SLUGS.includes(value), {
      error: "Cette adresse est réservée.",
    }),
  headline: optionalText(120, "Accroche"),
  about: optionalText(1200, "Présentation"),
  hours: optionalText(300, "Horaires"),
  area: optionalText(120, "Zone"),
  accent: z.enum(Object.keys(SITE_ACCENTS) as [SiteAccent, ...SiteAccent[]], {
    error: "Choisissez une couleur.",
  }),
  showPrices: z.boolean(),
  serviceIds: z
    .array(z.uuid())
    .max(24, { error: "24 prestations au maximum." }),
});

export type SiteFormInput = z.infer<typeof siteFormSchema>;

export const SITE_FORM_FIELDS = [
  "templateKey",
  "slug",
  "headline",
  "about",
  "hours",
  "area",
  "accent",
] as const;

/** Contenu enregistré (`websites.content`). */
export type SiteContent = {
  headline: string | null;
  about: string | null;
  hours: string | null;
  area: string | null;
  accent: SiteAccent;
  showPrices: boolean;
  serviceIds: string[];
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

export function readSiteContent(raw: unknown): SiteContent {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    headline: text(data.headline),
    about: text(data.about),
    hours: text(data.hours),
    area: text(data.area),
    accent: isSiteAccent(data.accent) ? data.accent : "indigo",
    showPrices: data.show_prices !== false,
    serviceIds: Array.isArray(data.service_ids)
      ? data.service_ids.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function contentToJson(input: SiteFormInput) {
  return {
    headline: input.headline,
    about: input.about,
    hours: input.hours,
    area: input.area,
    accent: input.accent,
    show_prices: input.showPrices,
    service_ids: input.serviceIds,
  };
}

/** Médias enregistrés (`websites.media`) : chemins dans `site-images`. */
export type SiteMedia = {
  logo: string | null;
  banner: string | null;
  gallery: string[];
};

export const SITE_GALLERY_MAX = 8;

export function readSiteMedia(raw: unknown): SiteMedia {
  const data =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    logo: text(data.logo),
    banner: text(data.banner),
    gallery: Array.isArray(data.gallery)
      ? data.gallery.filter((p): p is string => typeof p === "string")
      : [],
  };
}

export const SITE_MEDIA_KINDS = ["logo", "banner", "gallery"] as const;
export type SiteMediaKind = (typeof SITE_MEDIA_KINDS)[number];

/** Chemins encore utiles (brouillon ou instantané publié). */
export function referencedSiteImages(
  ...media: (SiteMedia | null)[]
): Set<string> {
  const paths = new Set<string>();
  for (const entry of media) {
    if (!entry) continue;
    if (entry.logo) paths.add(entry.logo);
    if (entry.banner) paths.add(entry.banner);
    for (const path of entry.gallery) paths.add(path);
  }
  return paths;
}
