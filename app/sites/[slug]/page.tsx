import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/loading-state";
import { SiteView } from "@/components/websites/site-view";
import { buildSiteModel } from "@/features/websites/model";
import { getPublicSite } from "@/features/websites/queries";

export async function generateMetadata({
  params,
}: PageProps<"/sites/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const site = await getPublicSite(slug);
  if (!site) return { title: "Page introuvable", robots: { index: false } };
  const headline = (site.content as { headline?: unknown })?.headline;
  return {
    title: { absolute: site.business.name },
    description: typeof headline === "string" ? headline : undefined,
  };
}

async function PublicSite({ slugPromise }: { slugPromise: Promise<string> }) {
  const slug = await slugPromise;
  const snapshot = await getPublicSite(slug);
  if (!snapshot) notFound();
  const site = buildSiteModel(
    snapshot,
    (bucket, path) =>
      `/sites/${slug}/media/${bucket === "site" ? "s" : "c"}/${path}`,
  );
  return <SiteView site={site} />;
}

// Site public : seul l'instantané publié est lu (jamais le brouillon), mis en
// cache par adresse et invalidé à la publication.
export default function PublicSitePage({ params }: PageProps<"/sites/[slug]">) {
  return (
    <main id="contenu" className="min-h-dvh bg-background">
      <Suspense fallback={<LoadingState />}>
        <PublicSite slugPromise={params.then((p) => p.slug)} />
      </Suspense>
      <footer className="px-4 pb-8 text-center text-xs text-muted-foreground">
        Site créé avec Céleste Biz
      </footer>
    </main>
  );
}
