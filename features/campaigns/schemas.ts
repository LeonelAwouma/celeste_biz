import { z } from "zod";

export const CAMPAIGN_SOURCES = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp_status: "Statut WhatsApp",
  tiktok: "TikTok",
  flyer: "Affiche ou flyer",
  other: "Autre",
} as const;
export type CampaignSource = keyof typeof CAMPAIGN_SOURCES;

export function isCampaignSource(value: unknown): value is CampaignSource {
  return typeof value === "string" && value in CAMPAIGN_SOURCES;
}

export const CAMPAIGN_CODE_PATTERN = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;

/** Code lisible proposé à partir du nom : « Robes été » → « ROBES-ETE ». */
export function suggestCampaignCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24)
    .replace(/-+$/, "");
}

const sources = Object.keys(CAMPAIGN_SOURCES) as [
  CampaignSource,
  ...CampaignSource[],
];

const baseFields = {
  label: z
    .string()
    .trim()
    .min(1, { error: "Donnez un nom à la campagne." })
    .max(80, { error: "80 caractères au maximum." }),
  source: z.enum(sources, { error: "Choisissez un canal." }),
  catalogItemId: z
    .union([z.uuid(), z.literal("")])
    .transform((value) => value || null),
  message: z
    .string()
    .trim()
    .min(1, { error: "Écrivez le message que le client enverra." })
    .max(500, { error: "500 caractères au maximum." }),
};

export const campaignCreateSchema = z.object({
  ...baseFields,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, { error: "3 caractères au minimum." })
    .max(24, { error: "24 caractères au maximum." })
    .regex(CAMPAIGN_CODE_PATTERN, {
      error: "Lettres sans accents, chiffres et tirets uniquement.",
    }),
});

export const campaignUpdateSchema = z.object({
  ...baseFields,
  id: z.uuid(),
  archived: z.boolean(),
});

export const CAMPAIGN_FORM_FIELDS = [
  "label",
  "code",
  "source",
  "catalogItemId",
  "message",
] as const;

/** Message que le client verra dans WhatsApp (même format que la base). */
export function campaignMessage(message: string, code: string): string {
  return `${message}\n\nRéf. ${code}`;
}

/**
 * Robots d'aperçu de lien (WhatsApp, Facebook…) : ils ouvrent le lien sans
 * clic humain, leurs visites ne sont pas comptées. L'agent utilisateur est
 * lu pour cette décision seulement, jamais enregistré.
 */
const PREVIEW_BOTS =
  /facebookexternalhit|facebot|whatsapp|twitterbot|telegrambot|slackbot|discordbot|linkedinbot|skypeuripreview|googlebot|bingbot|bot\b|crawler|spider|preview/i;

export function isPreviewBot(userAgent: string | null): boolean {
  return !userAgent || PREVIEW_BOTS.test(userAgent);
}
