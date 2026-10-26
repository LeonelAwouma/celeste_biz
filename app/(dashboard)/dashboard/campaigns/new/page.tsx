import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listPublicCatalog } from "@/features/websites/queries";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Nouvelle campagne" };

export default async function NewCampaignPage() {
  const { business } = await getBusinessContext();
  if (!can(business.role, "campaigns.write")) redirect("/dashboard/campaigns");
  const catalog = await listPublicCatalog(business.id);

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
        title="Nouvelle campagne"
        description="Un lien court qui ouvre WhatsApp sur votre numéro avec un message prêt à envoyer."
      />
      {!business.whatsappPhone ? (
        <p className="mb-4 rounded-lg bg-muted p-3 text-sm">
          Ajoutez d&apos;abord votre numéro WhatsApp dans{" "}
          <Link href="/dashboard/settings" className="text-primary underline">
            Paramètres
          </Link>{" "}
          : sans lui, le lien affichera « lien indisponible ».
        </p>
      ) : null}
      <CampaignForm
        catalog={catalog.map((item) => ({ id: item.id, name: item.name }))}
      />
    </>
  );
}
