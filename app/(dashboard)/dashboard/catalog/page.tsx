import type { Metadata } from "next";
import { Package } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Catalogue" };

export default function Page() {
  return (
    <>
      <PageHeader title="Catalogue" description="Vos services et produits." />
      <EmptyState
        icon={Package}
        title="Catalogue vide"
        description="Ajoutez vos services ou produits avec un prix fixe, « à partir de » ou « sur devis » pour aller plus vite lors des commandes."
      />
    </>
  );
}
