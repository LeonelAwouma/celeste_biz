import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ModuleDisabled } from "@/components/dashboard/module-disabled";
import { EmptyState } from "@/components/feedback/empty-state";
import { getBusinessContext } from "@/features/businesses/active-business";

export const metadata: Metadata = { title: "Devis" };

export default async function Page() {
  const { modules } = await getBusinessContext();

  return (
    <>
      <PageHeader
        title="Devis"
        description="Vos devis envoyés et leur réponse."
      />
      {modules.has("quotes") ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description="Préparez un devis, partagez-le à votre client et transformez-le en commande quand il est accepté."
        />
      ) : (
        <ModuleDisabled label="Devis" />
      )}
    </>
  );
}
