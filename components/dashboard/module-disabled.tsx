import Link from "next/link";
import { PowerOff } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";

export function ModuleDisabled({ label }: { label: string }) {
  return (
    <EmptyState
      icon={PowerOff}
      title={`Module « ${label} » désactivé`}
      description="Ce module facultatif est désactivé pour votre entreprise. Le propriétaire peut l'activer dans les paramètres."
      action={
        <Button asChild variant="outline">
          <Link href="/dashboard/settings#modules">Voir les modules</Link>
        </Button>
      }
    />
  );
}
