import type { Metadata } from "next";
import { Receipt } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Factures" };

export default function Page() {
  return (
    <>
      <PageHeader title="Factures" description="Vos factures et reçus." />
      <EmptyState
        icon={Receipt}
        title="Aucune facture"
        description="Les factures et reçus que vous préparez apparaîtront ici. Les brouillons restent modifiables jusqu'à leur émission."
      />
    </>
  );
}
