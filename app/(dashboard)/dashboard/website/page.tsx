import type { Metadata } from "next";
import { Globe } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { ModuleDisabled } from "@/components/dashboard/module-disabled";
import { EmptyState } from "@/components/feedback/empty-state";
import { getBusinessContext } from "@/features/businesses/active-business";

export const metadata: Metadata = { title: "Mon site" };

export default async function Page() {
  const { modules } = await getBusinessContext();

  return (
    <>
      <PageHeader
        title="Mon site"
        description="Facultatif : vous pouvez gérer vos commandes sans site web."
      />
      {modules.has("website") ? (
        <EmptyState
          icon={Globe}
          title="Pas de site pour l'instant"
          description="Créer un site est facultatif. Vous pourrez en créer un plus tard, à partir d'un modèle adapté à votre métier."
        />
      ) : (
        <ModuleDisabled label="Mon site" />
      )}
    </>
  );
}
