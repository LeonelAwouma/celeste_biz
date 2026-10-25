import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { NEW_ORDER_HREF } from "@/components/dashboard/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export const metadata: Metadata = { title: "Commandes" };

export default function Page() {
  return (
    <>
      <PageHeader
        title="Commandes"
        description="Toutes vos commandes et leur état."
      />
      <EmptyState
        icon={ClipboardList}
        title="Aucune commande"
        description="Enregistrez une commande reçue à l'atelier, par téléphone ou sur WhatsApp : vous retrouverez ici son état, son délai et son solde."
        action={
          <Button asChild>
            <Link href={NEW_ORDER_HREF}>Nouvelle commande</Link>
          </Button>
        }
      />
    </>
  );
}
