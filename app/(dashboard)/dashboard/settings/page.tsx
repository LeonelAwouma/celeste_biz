import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Votre entreprise, vos membres et vos préférences."
      />
      <EmptyState
        icon={Settings}
        title="Paramètres à venir"
        description="Vous pourrez ici renseigner votre entreprise, votre numéro WhatsApp et inviter vos employés."
      />
    </>
  );
}
