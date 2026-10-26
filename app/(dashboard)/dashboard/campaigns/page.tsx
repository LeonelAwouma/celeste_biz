import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Megaphone, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listCampaigns } from "@/features/campaigns/queries";
import { CAMPAIGN_SOURCES } from "@/features/campaigns/schemas";
import { plural } from "@/features/dashboard/alerts";
import { can } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campagnes" };

export default async function CampaignsPage({
  searchParams,
}: PageProps<"/dashboard/campaigns">) {
  const params = await searchParams;
  const archived = params.archives === "1";
  const { business } = await getBusinessContext();
  const canWrite = can(business.role, "campaigns.write");
  const campaigns = await listCampaigns(business.id, archived);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Campagnes"
          description="Liens WhatsApp à publier sur vos réseaux, avec une référence pour savoir d'où viennent vos clients."
        />
        {canWrite ? (
          <Button asChild className="shrink-0">
            <Link href="/dashboard/campaigns/new">
              <Plus aria-hidden="true" />
              Nouveau
            </Link>
          </Button>
        ) : null}
      </div>
      <nav aria-label="Filtre" className="mb-4 flex gap-2">
        {[
          { href: "/dashboard/campaigns", label: "Actives", active: !archived },
          {
            href: "/dashboard/campaigns?archives=1",
            label: "Archivées",
            active: archived,
          },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm",
              tab.active && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {campaigns.length ? (
        <ul className="flex flex-col divide-y rounded-xl border bg-card">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link
                href={`/dashboard/campaigns/${campaign.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{campaign.label}</span>
                  <span className="text-sm text-muted-foreground">
                    {campaign.code} · {CAMPAIGN_SOURCES[campaign.source]}
                  </span>
                  <span className="text-sm">
                    {plural(campaign.clickCount, "clic")} ·{" "}
                    {plural(campaign.ordersCount, "commande")}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Megaphone}
          title={archived ? "Aucune campagne archivée" : "Aucune campagne"}
          description="Créez un lien pour une offre : le client arrive sur WhatsApp avec un message prêt, suivi d'une référence (ex. « Réf. ROBE-WAX »)."
          action={
            canWrite && !archived ? (
              <Button asChild>
                <Link href="/dashboard/campaigns/new">Créer un lien</Link>
              </Button>
            ) : undefined
          }
        />
      )}
    </>
  );
}
