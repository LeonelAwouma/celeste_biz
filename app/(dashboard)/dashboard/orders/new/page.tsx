import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Nouvelle commande"
        description="Enregistrez une commande en quelques secondes."
      />
      <EmptyState
        icon={ClipboardList}
        title="Bientôt disponible"
        description="Le formulaire de commande arrive avec la gestion des commandes et des acomptes."
      />
    </>
  );
}
