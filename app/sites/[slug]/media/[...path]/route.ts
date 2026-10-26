import { createAnonClient } from "@/lib/supabase/anon";

const BUCKETS = { s: "site-images", c: "catalog-images" } as const;
const PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;
const TYPES = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

/**
 * Photo d'un site publié. Le stockage n'autorise la lecture anonyme que des
 * fichiers listés dans un instantané publié ; tout autre chemin répond 404.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/sites/[slug]/media/[...path]">,
) {
  const { path } = await params;
  const [bucketKey, ...rest] = path;
  const objectPath = rest.join("/");
  const bucket = BUCKETS[bucketKey as keyof typeof BUCKETS];
  if (!bucket || !PATH.test(objectPath)) {
    return new Response("Introuvable", { status: 404 });
  }
  const { data } = await createAnonClient()
    .storage.from(bucket)
    .download(objectPath);
  if (!data) return new Response("Introuvable", { status: 404 });
  const extension = objectPath.split(".").pop() as keyof typeof TYPES;
  return new Response(data, {
    headers: {
      "Content-Type": TYPES[extension],
      // Fichier immuable (nom aléatoire) ; cache court en cas de dépublication.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
