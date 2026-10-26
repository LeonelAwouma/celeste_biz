import "server-only";

import { updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import { siteCacheTag } from "./queries";

/**
 * À appeler depuis une action serveur qui change la visibilité du site
 * (module désactivé, métier changé) : vide le cache de son adresse publiée.
 */
export async function invalidatePublishedSite(businessId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("websites")
    .select("published_slug")
    .eq("business_id", businessId)
    .maybeSingle();
  if (data?.published_slug) updateTag(siteCacheTag(data.published_slug));
}
