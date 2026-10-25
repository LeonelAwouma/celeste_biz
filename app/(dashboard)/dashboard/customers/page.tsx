import type { Metadata } from "next";
import { Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Clients" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Clients"
        description="Vos clients et leur historique."
      />
      <EmptyState
        icon={Users}
        title="Aucun client"
        description="Ajoutez un client avec un nom et, si vous voulez, un numéro de téléphone. Vous verrez ses commandes et son solde."
      />
    </>
  );
}
