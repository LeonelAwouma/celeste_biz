import type { Metadata } from "next";
import Link from "next/link";
import { Globe } from "lucide-react";

import { ModuleDisabled } from "@/components/dashboard/module-disabled";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { SubmitButton } from "@/components/forms/submit-button";
import { SettingsCard } from "@/components/settings/settings-card";
import { Button } from "@/components/ui/button";
import { PublishPanel } from "@/components/websites/publish-panel";
import { SiteEditorForm } from "@/components/websites/site-editor-form";
import { SiteMediaForm } from "@/components/websites/site-media-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { createWebsite } from "@/features/websites/actions";
import { buildDraftModel } from "@/features/websites/draft";
import { servicePriceLabel } from "@/features/websites/model";
import { getWebsite } from "@/features/websites/queries";
import {
  SITE_GALLERY_MAX,
  readSiteContent,
  readSiteMedia,
} from "@/features/websites/schemas";
import {
  SITE_TEMPLATES,
  getSiteTemplate,
  isSiteTemplateKey,
} from "@/features/websites/templates";
import { getAppUrl } from "@/lib/env";
import { can } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Mon site" };

function CreateSite({ defaultTemplate }: { defaultTemplate: string }) {
  return (
    <SettingsCard
      id="creer"
      title="Créer mon site"
      description="Une page simple pour présenter vos prestations et recevoir des messages WhatsApp. Rien n'est publié sans votre accord."
    >
      <form action={createWebsite} className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 font-medium">Choisissez un modèle</legend>
          {Object.values(SITE_TEMPLATES).map((entry) => (
            <label
              key={entry.key}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary"
            >
              <input
                type="radio"
                name="templateKey"
                value={entry.key}
                defaultChecked={entry.key === defaultTemplate}
                className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
              />
              <span className="flex flex-col">
                <span className="font-medium">{entry.label}</span>
                <span className="text-sm text-muted-foreground">
                  {entry.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="grid gap-2 sm:grid-cols-2">
          <SubmitButton pendingLabel="Création…">Créer mon site</SubmitButton>
          <Button asChild variant="outline">
            <Link href="/dashboard/today">Plus tard</Link>
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

export default async function Page() {
  const { business, modules } = await getBusinessContext();
  const header = (
    <PageHeader
      title="Mon site"
      description="Facultatif : vous pouvez gérer vos commandes sans site web."
    />
  );
  if (!modules.has("website")) {
    return (
      <>
        {header}
        <ModuleDisabled label="Mon site" />
      </>
    );
  }

  const editable = can(business.role, "website.write");
  const website = await getWebsite(business.id);
  if (!website) {
    return (
      <>
        {header}
        {editable ? (
          <CreateSite
            defaultTemplate={
              isSiteTemplateKey(business.professionKey)
                ? business.professionKey
                : "generic"
            }
          />
        ) : (
          <EmptyState
            icon={Globe}
            title="Pas de site pour l'instant"
            description="Le propriétaire ou le gestionnaire peut créer un site à partir d'un modèle adapté à votre métier."
          />
        )}
      </>
    );
  }

  const { catalog, siteUrls } = await buildDraftModel(
    business.id,
    business,
    website,
  );
  const content = readSiteContent(website.content);
  const media = readSiteMedia(website.media);
  const published = website.published;
  const status = published
    ? published.version === website.version
      ? "published"
      : "outdated"
    : website.unpublishedAt
      ? "unpublished"
      : "never";
  const statusText =
    status === "published"
      ? `En ligne depuis le ${formatDateTime(published!.publishedAt!)}. Le site montre votre dernier brouillon (les prix du catalogue sont ceux du jour de publication).`
      : status === "outdated"
        ? `En ligne (version du ${formatDateTime(published!.publishedAt!)}). Vos dernières modifications ne sont pas encore publiées.`
        : status === "unpublished"
          ? `Retiré le ${formatDateTime(website.unpublishedAt!)}. Le brouillon est conservé.`
          : "Brouillon : rien n'est visible tant que vous n'avez pas publié le site.";
  const preview = (path: string) => ({ path, url: siteUrls.get(path) ?? null });

  return (
    <>
      {header}
      <div className="flex flex-col gap-4">
        <SettingsCard id="publication" title="Publication">
          <PublishPanel
            version={website.version}
            status={status}
            statusText={statusText}
            publicUrl={
              website.publishedSlug
                ? `${getAppUrl()}/sites/${website.publishedSlug}`
                : null
            }
            editable={editable}
          />
          {!business.whatsappPhone ? (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Ajoutez votre numéro WhatsApp dans{" "}
              <Link
                href="/dashboard/settings"
                className="text-primary underline"
              >
                Paramètres
              </Link>{" "}
              pour afficher le bouton de contact (pris en compte à la prochaine
              publication).
            </p>
          ) : null}
        </SettingsCard>
        {editable ? (
          <>
            <SettingsCard
              id="contenu"
              title="Contenu"
              description={`Modèle « ${getSiteTemplate(website.templateKey).label} ». Enregistrez, prévisualisez, puis publiez.`}
            >
              <SiteEditorForm
                version={website.version}
                templateKey={getSiteTemplate(website.templateKey).key}
                slug={website.slug}
                content={content}
                services={catalog.map((item) => ({
                  id: item.id,
                  name: item.name,
                  priceLabel: servicePriceLabel(item, true),
                }))}
                publicBase={`${getAppUrl()}/sites/`}
              />
            </SettingsCard>
            <SettingsCard
              id="photos"
              title="Photos"
              description="Réduites automatiquement pour économiser les données mobiles."
            >
              <SiteMediaForm
                logo={media.logo ? preview(media.logo) : null}
                banner={media.banner ? preview(media.banner) : null}
                gallery={media.gallery.map(preview)}
                galleryMax={SITE_GALLERY_MAX}
              />
            </SettingsCard>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Seuls le propriétaire et le gestionnaire modifient le site.
          </p>
        )}
      </div>
    </>
  );
}
