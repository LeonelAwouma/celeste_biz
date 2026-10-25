import type { Metadata } from "next";
import { Wallet } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Encaissements" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Encaissements"
        description="Les acomptes et paiements enregistrés."
      />
      <EmptyState
        icon={Wallet}
        title="Aucun encaissement"
        description="Les acomptes et paiements que vous enregistrez apparaîtront ici, avec leur mode et leur date."
      />
    </>
  );
}
