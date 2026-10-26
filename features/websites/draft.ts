import "server-only";

import { buildSiteModel, type SiteModel, type SiteService } from "./model";
import { listPublicCatalog, signedImageUrls, type WebsiteRow } from "./queries";
import { readSiteContent, readSiteMedia } from "./schemas";

type Business = {
  name: string;
  city: string | null;
  whatsappPhone: string | null;
};

/**
 * Aperçu du brouillon, rendu comme le site publié : prestations choisies
 * lues dans le catalogue actuel, photos par URL signées (session du
 * commerçant). Rien ici n'est accessible publiquement.
 */
export async function buildDraftModel(
  businessId: string,
  business: Business,
  website: WebsiteRow,
): Promise<{
  site: SiteModel;
  catalog: Awaited<ReturnType<typeof listPublicCatalog>>;
  siteUrls: Map<string, string>;
}> {
  const content = readSiteContent(website.content);
  const media = readSiteMedia(website.media);
  const catalog = await listPublicCatalog(businessId);
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const services: SiteService[] = content.serviceIds.flatMap((id) => {
    const item = byId.get(id);
    return item
      ? [
          {
            name: item.name,
            description: item.description,
            category: item.category,
            price_mode: item.price_mode,
            price: item.price,
            unit: item.unit,
            image: item.image_path,
          },
        ]
      : [];
  });

  const sitePaths = [media.logo, media.banner, ...media.gallery].filter(
    (path): path is string => !!path,
  );
  const catalogPaths = services.flatMap((s) => (s.image ? [s.image] : []));
  const [siteUrls, catalogUrls] = await Promise.all([
    signedImageUrls("site-images", sitePaths),
    signedImageUrls("catalog-images", catalogPaths),
  ]);

  const site = buildSiteModel(
    {
      template_key: website.templateKey,
      business: {
        name: business.name,
        city: business.city,
        whatsapp: business.whatsappPhone,
      },
      content: website.content,
      media: website.media,
      services,
    },
    (bucket, path) =>
      (bucket === "site" ? siteUrls : catalogUrls).get(path) ?? null,
  );
  return { site, catalog, siteUrls };
}
