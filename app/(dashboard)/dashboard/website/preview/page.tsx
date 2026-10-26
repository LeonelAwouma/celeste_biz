import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { SiteView } from "@/components/websites/site-view";
import { getBusinessContext } from "@/features/businesses/active-business";
import { buildDraftModel } from "@/features/websites/draft";
import { getWebsite } from "@/features/websites/queries";

export const metadata: Metadata = { title: "Aperçu du site" };

export default async function Page() {
  const { business, modules } = await getBusinessContext();
  if (!modules.has("website")) redirect("/dashboard/website");
  const website = await getWebsite(business.id);
  if (!website) redirect("/dashboard/website");
  const { site } = await buildDraftModel(business.id, business, website);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        <p>
          <strong>Aperçu du brouillon</strong> : non publié, visible par votre
          équipe uniquement.
        </p>
        <Link
          href="/dashboard/website"
          className="inline-flex min-h-11 items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Retour à l&apos;éditeur
        </Link>
      </div>
      <div
        className="overflow-hidden rounded-xl border bg-background"
        data-testid="site-preview"
      >
        <SiteView site={site} />
      </div>
    </div>
  );
}
