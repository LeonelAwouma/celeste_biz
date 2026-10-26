import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, History } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  EXPORT_KINDS,
  EXPORT_LABELS,
  EXPORT_MAX_ROWS,
} from "@/features/exports/definitions";
import { can } from "@/lib/permissions/roles";
import { todayLocal } from "@/lib/time";

export const metadata: Metadata = { title: "Exports" };

export default async function ExportsPage() {
  const { business } = await getBusinessContext();
  if (!can(business.role, "exports.run")) redirect("/dashboard/settings");
  const today = todayLocal();
  const monthStart = `${today.slice(0, 8)}01`;

  return (
    <>
      <PageHeader
        title="Exports"
        description="Vos données vous appartiennent : téléchargez-les au format CSV (ouvrable dans Excel ou Google Sheets)."
      />
      <div className="flex flex-col gap-4">
        <SettingsCard
          id="csv"
          title="Télécharger un fichier CSV"
          description={`Période facultative (laisser vide pour tout exporter). ${EXPORT_MAX_ROWS.toLocaleString("fr-FR")} lignes au maximum par fichier.`}
        >
          <form
            method="get"
            action="/dashboard/exports/telecharger"
            className="flex flex-col gap-4"
          >
            <SelectField
              name="type"
              label="Données"
              defaultValue="orders"
              options={EXPORT_KINDS.map((kind) => ({
                value: kind,
                label: EXPORT_LABELS[kind],
              }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                name="du"
                label="Du"
                type="date"
                defaultValue={monthStart}
                max={today}
              />
              <FormField
                name="au"
                label="Au"
                type="date"
                defaultValue={today}
                max={today}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Période appliquée à la date de création (date de paiement pour les
              encaissements) ; le catalogue est toujours exporté en entier.
              Chaque export est inscrit au journal.
            </p>
            <Button type="submit" size="lg">
              <Download aria-hidden="true" />
              Télécharger
            </Button>
          </form>
        </SettingsCard>
        <SettingsCard
          id="journal"
          title="Journal des actions"
          description="Qui a émis, annulé, exporté ou publié, et quand."
        >
          <Button asChild variant="outline">
            <Link href="/dashboard/audit">
              <History aria-hidden="true" />
              Ouvrir le journal
            </Link>
          </Button>
        </SettingsCard>
      </div>
    </>
  );
}
