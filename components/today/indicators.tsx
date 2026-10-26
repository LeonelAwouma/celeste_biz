import Link from "next/link";

import type { DashboardSummary } from "@/features/dashboard/summary";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatDate } from "@/lib/time";

function Tile({
  label,
  value,
  detail,
  href,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
  testId: string;
}) {
  const content = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className="text-lg leading-tight font-semibold break-words"
        data-testid={testId}
      >
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </>
  );
  const className =
    "flex min-w-0 flex-col gap-1 rounded-xl border bg-card px-3 py-3";
  return href ? (
    <Link href={href} className={`${className} hover:bg-accent`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * Indicateurs du jour. Les encaissements sont ceux enregistrés (déclarés) ;
 * aucun bénéfice n'est affiché faute de coûts connus.
 */
export function Indicators({
  summary,
  quotesEnabled,
}: {
  summary: DashboardSummary;
  quotesEnabled: boolean;
}) {
  const { week, month } = summary.payments;
  return (
    <section aria-label="Indicateurs" className="grid grid-cols-2 gap-2">
      <Tile
        label="Commandes en cours"
        value={String(summary.activeCount)}
        detail={
          summary.draftCount
            ? `+ ${summary.draftCount} brouillon${summary.draftCount > 1 ? "s" : ""}`
            : "hors brouillons"
        }
        href="/dashboard/orders"
        testId="kpi-active"
      />
      <Tile
        label="Soldes à encaisser"
        value={formatXaf(summary.toCollect.total)}
        detail={`${summary.toCollect.count} commande${summary.toCollect.count > 1 ? "s" : ""}`}
        href="/dashboard/orders?filtre=to_collect"
        testId="kpi-to-collect"
      />
      <Tile
        label="Encaissé sur 7 jours"
        value={formatXaf(week.total)}
        detail={`Déclaré, du ${formatDate(week.from)}`}
        testId="kpi-week"
      />
      <Tile
        label="Encaissé ce mois"
        value={formatXaf(month.total)}
        detail={`${month.count} encaissement${month.count > 1 ? "s" : ""} déclaré${month.count > 1 ? "s" : ""}`}
        testId="kpi-month"
      />
      {quotesEnabled ? (
        <Tile
          label="Devis sans réponse"
          value={String(summary.quotesWaiting.count)}
          detail={`envoyés il y a plus de ${summary.thresholds.quoteDays} jours`}
          href="/dashboard/quotes"
          testId="kpi-quotes"
        />
      ) : null}
    </section>
  );
}
