import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { createAnonClient } from "@/lib/supabase/anon";
import { createClient } from "@/lib/supabase/server";

import { SITE_SLUG_PATTERN } from "./schemas";
import { parsePublishedSnapshot, type PublishedSnapshot } from "./model";

export type WebsiteRow = {
  id: string;
  slug: string;
  templateKey: string;
  content: unknown;
  media: unknown;
  version: number;
  published: PublishedSnapshot | null;
  publishedSlug: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
};

/** Site (brouillon + dernier instantané) de l'entreprise, s'il existe. */
export async function getWebsite(
  businessId: string,
): Promise<WebsiteRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select(
      "id, slug, template_key, content, media, version, published, published_slug, published_at, unpublished_at",
    )
    .eq("business_id", businessId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    templateKey: data.template_key,
    content: data.content,
    media: data.media,
    version: data.version,
    published: parsePublishedSnapshot(data.published),
    publishedSlug: data.published_slug,
    publishedAt: data.published_at,
    unpublishedAt: data.unpublished_at,
  };
}

export const siteCacheTag = (slug: string) => `site:${slug}`;

/**
 * Site publié, mis en cache par adresse et invalidé à chaque publication ou
 * dépublication (`updateTag`). Lecture anonyme de l'instantané seulement.
 */
export async function getPublicSite(
  slug: string,
): Promise<PublishedSnapshot | null> {
  "use cache";
  cacheTag(siteCacheTag(slug));
  cacheLife("hours");
  if (!SITE_SLUG_PATTERN.test(slug) || slug.length > 60) return null;
  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc("get_public_site", {
    p_slug: slug,
  });
  if (error) throw new Error("Site momentanément indisponible.");
  return parsePublishedSnapshot(data);
}

/** Prestations publiques actives, pour le choix dans l'éditeur. */
export async function listPublicCatalog(businessId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select(
      "id, name, description, category, price_mode, price, unit, image_path",
    )
    .eq("business_id", businessId)
    .eq("visibility", "public")
    .is("archived_at", null)
    .order("category", { ascending: true, nullsFirst: false })
    .order("position")
    .order("name")
    .limit(500);
  return data ?? [];
}

/** URL signées (aperçu du brouillon, session du commerçant). */
export async function signedImageUrls(
  bucket: "site-images" | "catalog-images",
  paths: string[],
): Promise<Map<string, string>> {
  if (!paths.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, 60 * 30);
  return new Map(
    (data ?? []).flatMap((entry) =>
      entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [],
    ),
  );
}
