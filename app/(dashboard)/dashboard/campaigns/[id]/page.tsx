import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CampaignForm } from "@/components/campaigns/campaign-form";
import { ShareLink } from "@/components/campaigns/share-link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsCard } from "@/components/settings/settings-card";
import { getBusinessContext } from "@/features/businesses/active-business";
import { getCampaign, getDailyClicks } from "@/features/campaigns/queries";
import {
  CAMPAIGN_SOURCES,
  campaignMessage,
} from "@/features/campaigns/schemas";
import { listPublicCatalog } from "@/features/websites/queries";
import { getAppUrl } from "@/lib/env";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Campagne" };

export default async function CampaignPage({
  params,
  searchParams,
}: PageProps<"/dashboard/campaigns/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { business } = await getBusinessContext();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const campaign = await getCampaign(business.id, id);
  if (!campaign) notFound();
  const canWrite = can(business.role, "campaigns.write");
  const [daily, catalog] = await Promise.all([
    getDailyClicks(business.id, campaign.id),
    canWrite ? listPublicCatalog(business.id) : Promise.resolve([]),
  ]);
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  const url = `${getAppUrl()}/c/${campaign.publicId}`;

  return (
    <>
      <Link
        href="/dashboard/campaigns"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Campagnes
      </Link>
      <PageHeader
        title={campaign.label}
        description={`${campaign.code} · ${CAMPAIGN_SOURCES[campaign.source]}${campaign.archivedAt ? " · archivée" : ""}`}
      />
      {query.cree === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Lien créé. Copiez-le dans votre publication.
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        <SettingsCard
          id="lien"
          title="Lien à publier"
          description="Le client arrive sur WhatsApp, sur votre numéro, avec ce message."
        >
          <ShareLink url={url} label={campaign.label} />
          <p className="rounded-lg bg-muted p-3 text-sm break-words whitespace-pre-line">
            {campaignMessage(campaign.message, campaign.code)}
          </p>
          <p className="text-xs text-muted-foreground">
            Le lien n&apos;ouvre qu&apos;une conversation : Céleste Biz ne lit
            pas vos messages WhatsApp. Créez la commande vous-même et indiquez
            sa provenance sur la fiche commande.
          </p>
        </SettingsCard>

        <SettingsCard
          id="resultats"
          title="Résultats"
          description="Clics comptés sans identifier les visiteurs (aperçus automatiques exclus) ; commandes selon la provenance que vous avez indiquée."
        >
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border p-2">
              <dt className="text-xs text-muted-foreground">Clics</dt>
              <dd
                className="text-lg font-semibold"
                data-testid="campaign-clicks"
              >
                {campaign.clickCount}
              </dd>
            </div>
            <div className="rounded-lg border p-2">
              <dt className="text-xs text-muted-foreground">7 jours</dt>
              <dd className="text-lg font-semibold">{campaign.clicks7d}</dd>
            </div>
            <div className="rounded-lg border p-2">
              <dt className="text-xs text-muted-foreground">Commandes</dt>
              <dd
                className="text-lg font-semibold"
                data-testid="campaign-orders"
              >
                {campaign.ordersCount}
              </dd>
            </div>
          </dl>
          {campaign.ordersCount ? (
            <p className="text-sm">
              Montant des commandes : {formatXaf(campaign.ordersTotal)}
            </p>
          ) : null}
          <figure className="flex flex-col gap-2">
            <figcaption className="text-sm text-muted-foreground">
              Clics des 14 derniers jours
            </figcaption>
            <ol
              className="flex h-24 items-end gap-1"
              aria-label="Clics par jour"
            >
              {daily.map((d) => (
                <li
                  key={d.day}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${formatDate(d.day)} : ${d.clicks}`}
                >
                  <span className="sr-only">
                    {formatDate(d.day)} : {d.clicks}
                  </span>
                  <span
                    aria-hidden="true"
                    className="block rounded-t bg-primary"
                    style={{
                      height: `${Math.max(d.clicks ? 8 : 2, (d.clicks / max) * 100)}%`,
                      opacity: d.clicks ? 1 : 0.25,
                    }}
                  />
                </li>
              ))}
            </ol>
          </figure>
          {campaign.lastClickAt ? (
            <p className="text-xs text-muted-foreground">
              Dernier clic : {formatDateTime(campaign.lastClickAt)}
            </p>
          ) : null}
        </SettingsCard>

        {canWrite ? (
          <SettingsCard id="modifier" title="Modifier">
            <CampaignForm
              catalog={catalog.map((item) => ({
                id: item.id,
                name: item.name,
              }))}
              initial={{
                id: campaign.id,
                code: campaign.code,
                label: campaign.label,
                source: campaign.source,
                catalogItemId: campaign.catalogItemId,
                message: campaign.message,
                archived: Boolean(campaign.archivedAt),
              }}
            />
          </SettingsCard>
        ) : null}
      </div>
    </>
  );
}
