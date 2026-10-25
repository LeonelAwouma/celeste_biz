import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Mon site" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Mon site"
        description="Facultatif : vous pouvez gérer vos commandes sans site web."
      />
      <EmptyState
        icon={Globe}
        title="Pas de site pour l'instant"
        description="Créer un site est facultatif. Vous pourrez en créer un plus tard, à partir d'un modèle adapté à votre métier."
      />
    </>
  );
}
