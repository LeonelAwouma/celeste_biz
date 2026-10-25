import type { Metadata } from "next";
import { Package } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { getBusinessContext } from "@/features/businesses/active-business";

export const metadata: Metadata = { title: "Catalogue" };

export default async function Page() {
  const { template } = await getBusinessContext();

  return (
    <>
      <PageHeader title="Catalogue" description={template.labels.catalog} />
      <EmptyState
        icon={Package}
        title="Catalogue vide"
        description="Ajoutez vos services ou produits avec un prix fixe, « à partir de » ou « sur devis » pour aller plus vite lors des commandes."
      />
    </>
  );
}
