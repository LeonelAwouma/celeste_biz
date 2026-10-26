import { formatCatalogPrice } from "@/features/catalog/format";

import { readSiteContent, readSiteMedia, type SiteContent } from "./schemas";
import { SITE_ACCENTS, getSiteTemplate, type SiteTemplate } from "./templates";

/** Site prêt à afficher (publié ou aperçu du brouillon). */
export type SiteModel = {
  template: SiteTemplate;
  accentColor: string;
  business: { name: string; city: string | null; whatsapp: string | null };
  content: Omit<SiteContent, "serviceIds" | "accent">;
  logoUrl: string | null;
  bannerUrl: string | null;
  gallery: string[];
  services: {
    name: string;
    description: string | null;
    category: string | null;
    priceLabel: string;
    imageUrl: string | null;
  }[];
};

export type SiteService = {
  name: string;
  description: string | null;
  category: string | null;
  price_mode: string;
  price: number | string | null;
  unit: string | null;
  image: string | null;
};

/** Libellé de prix ; « Prix sur demande » si le commerçant masque les prix. */
export function servicePriceLabel(
  service: Pick<SiteService, "price_mode" | "price" | "unit">,
  showPrices: boolean,
): string {
  if (!showPrices && service.price_mode !== "quote") return "Prix sur demande";
  return formatCatalogPrice(service.price_mode, service.price, service.unit);
}

type ImageUrl = (bucket: "site" | "catalog", path: string) => string | null;

/**
 * Construit le modèle affichable à partir d'un instantané publié (ou d'un
 * brouillon mis sous la même forme). Les URL d'images sont fournies par
 * l'appelant (route publique ou URL signées de l'aperçu).
 */
export function buildSiteModel(
  snapshot: {
    template_key: unknown;
    business: { name: string; city: string | null; whatsapp: string | null };
    content: unknown;
    media: unknown;
    services: SiteService[];
  },
  imageUrl: ImageUrl,
): SiteModel {
  const content = readSiteContent(snapshot.content);
  const media = readSiteMedia(snapshot.media);
  return {
    template: getSiteTemplate(snapshot.template_key),
    accentColor: SITE_ACCENTS[content.accent].color,
    business: snapshot.business,
    content: {
      headline: content.headline,
      about: content.about,
      hours: content.hours,
      area: content.area,
      showPrices: content.showPrices,
    },
    logoUrl: media.logo ? imageUrl("site", media.logo) : null,
    bannerUrl: media.banner ? imageUrl("site", media.banner) : null,
    gallery: media.gallery
      .map((path) => imageUrl("site", path))
      .filter((url): url is string => url !== null),
    services: snapshot.services.map((service) => ({
      name: service.name,
      description: service.description,
      category: service.category,
      priceLabel: servicePriceLabel(service, content.showPrices),
      imageUrl: service.image ? imageUrl("catalog", service.image) : null,
    })),
  };
}

const str = (value: unknown) => (typeof value === "string" ? value : null);

/** Réponse de `get_public_site` → instantané typé, ou null. */
export function parsePublishedSnapshot(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const business = (data.business ?? {}) as Record<string, unknown>;
  const services = Array.isArray(data.services) ? data.services : [];
  return {
    template_key: data.template_key,
    business: {
      name: str(business.name) ?? "",
      city: str(business.city),
      whatsapp: str(business.whatsapp),
    },
    content: data.content,
    media: data.media,
    services: services
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        name: str(s.name) ?? "",
        description: str(s.description),
        category: str(s.category),
        price_mode: str(s.price_mode) ?? "quote",
        price:
          typeof s.price === "number" || typeof s.price === "string"
            ? s.price
            : null,
        unit: str(s.unit),
        image: str(s.image),
      })),
    publishedAt: str(data.published_at),
    version: typeof data.version === "number" ? data.version : null,
  };
}

export type PublishedSnapshot = NonNullable<
  ReturnType<typeof parsePublishedSnapshot>
>;
