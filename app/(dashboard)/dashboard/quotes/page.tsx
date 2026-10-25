import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Devis" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Devis"
        description="Vos devis envoyés et leur réponse."
      />
      <EmptyState
        icon={FileText}
        title="Aucun devis"
        description="Préparez un devis, partagez-le à votre client et transformez-le en commande quand il est accepté."
      />
    </>
  );
}
