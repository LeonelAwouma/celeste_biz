import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { NEW_ORDER_HREF } from "@/components/dashboard/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Aujourd'hui" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Aujourd'hui"
        description="Ce qu'il y a à faire aujourd'hui."
      />
      <EmptyState
        icon={CalendarCheck}
        title="Rien à faire pour l'instant"
        description="Vos livraisons proches, soldes à encaisser et devis en attente apparaîtront ici dès votre première commande."
        action={
          <Button asChild>
            <Link href={NEW_ORDER_HREF}>Nouvelle commande</Link>
          </Button>
        }
      />
    </>
  );
}
