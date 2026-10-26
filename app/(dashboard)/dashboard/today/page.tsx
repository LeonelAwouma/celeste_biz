import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { AlertCard } from "@/components/today/alert-card";
import { GettingStarted } from "@/components/today/getting-started";
import { Indicators } from "@/components/today/indicators";
import { ProfessionSummary } from "@/components/today/profession-summary";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listMembers } from "@/features/businesses/team";
import { buildAlerts } from "@/features/dashboard/alerts";
import { getDashboardSummary } from "@/features/dashboard/queries";
import { can } from "@/lib/permissions/roles";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Aujourd'hui" };

export default async function TodayPage() {
  const context = await getBusinessContext();
  const { business, template, modules } = context;
  const [summary, members] = await Promise.all([
    getDashboardSummary(business.id),
    listMembers(business.id),
  ]);
  const quotesEnabled = modules.has("quotes");
  const alerts = buildAlerts(summary, {
    template,
    quotesEnabled,
    teamSize: members.length,
  });

  return (
    <>
      <PageHeader
        title="Aujourd'hui"
        description={`${business.name} · ${formatDate(summary.today)}`}
      />
      <div className="flex flex-col gap-6">
        {summary.hasOrders ? (
          <>
            <section aria-labelledby="a-faire" className="flex flex-col gap-3">
              <h2 id="a-faire" className="text-lg font-semibold">
                À faire
              </h2>
              {alerts.length ? (
                alerts.map((alert) => (
                  <AlertCard key={alert.key} alert={alert} />
                ))
              ) : (
                <p className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
                  <CircleCheck
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  Rien d&apos;urgent : aucune commande en retard ni à remettre
                  sous {summary.thresholds.dueHours} h, aucun solde en attente.
                </p>
              )}
            </section>
            <section aria-labelledby="chiffres" className="flex flex-col gap-3">
              <h2 id="chiffres" className="text-lg font-semibold">
                En chiffres
              </h2>
              <Indicators summary={summary} quotesEnabled={quotesEnabled} />
              <p className="text-xs text-muted-foreground">
                Calculé le {formatDateTime(summary.generatedAt)} à partir des
                commandes et des encaissements enregistrés. Aucun bénéfice
                n&apos;est estimé : les coûts ne sont pas saisis.
              </p>
            </section>
            {can(business.role, "orders.write") ? (
              <div className="grid grid-cols-2 gap-2">
                <Button asChild>
                  <Link href="/dashboard/orders/new">Nouvelle commande</Link>
                </Button>
                {quotesEnabled ? (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/quotes/new">Nouveau devis</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href="/dashboard/customers/new">Nouveau client</Link>
                  </Button>
                )}
              </div>
            ) : null}
          </>
        ) : (
          <GettingStarted context={context} />
        )}
        <ProfessionSummary template={template} modules={modules} />
      </div>
    </>
  );
}
