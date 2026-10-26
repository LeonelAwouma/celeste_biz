import "server-only";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

export type CatalogItem = {
  id: string;
  kind: "service" | "product";
  name: string;
  description: string | null;
  category: string | null;
  price_mode: "fixed" | "from" | "quote";
  price: number | string | null;
  unit: string | null;
  visibility: "public" | "private";
  position: number;
  image_path: string | null;
  archived_at: string | null;
  imageUrl?: string | null;
};

const COLUMNS =
  "id, kind, name, description, category, price_mode, price, unit, visibility, position, image_path, archived_at";
const SIGNED_URL_SECONDS = 60 * 30;

/** URL signées temporaires (bucket privé), générées côté serveur. */
async function withImageUrls(items: CatalogItem[]): Promise<CatalogItem[]> {
  const paths = items.flatMap((item) =>
    item.image_path ? [item.image_path] : [],
  );
  if (!paths.length) return items;
  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("catalog-images")
    .createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urls = new Map(
    (data ?? []).map((entry) => [entry.path, entry.signedUrl]),
  );
  return items.map((item) => ({
    ...item,
    imageUrl: item.image_path ? (urls.get(item.image_path) ?? null) : null,
  }));
}

/** Catalogue de l'entreprise (quelques centaines d'articles au plus). */
export async function listCatalogItems(
  businessId: string,
  options: { archived?: boolean; query?: string } = {},
): Promise<CatalogItem[]> {
  const supabase = await createClient();
  let request = supabase
    .from("catalog_items")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .order("category", { ascending: true, nullsFirst: false })
    .order("position")
    .order("name")
    .limit(500);
  request = options.archived
    ? request.not("archived_at", "is", null)
    : request.is("archived_at", null);

  const { data, error } = await request;
  if (error) throw new Error("Impossible de charger le catalogue.");

  const query = options.query?.trim().toLowerCase();
  const items = (data ?? []).filter(
    (item) =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.category?.toLowerCase().includes(query),
  );
  return withImageUrls(items);
}

export async function getCatalogItem(
  businessId: string,
  id: string,
): Promise<CatalogItem | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const [item] = await withImageUrls([data]);
  return item;
}

export async function listCategories(businessId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_items")
    .select("category")
    .eq("business_id", businessId)
    .not("category", "is", null)
    .limit(500);
  return [...new Set((data ?? []).map((row) => row.category as string))].sort(
    (a, b) => a.localeCompare(b, "fr"),
  );
}
