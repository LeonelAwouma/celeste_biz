import { statusLabel } from "@/features/orders/status";
import type { ProfessionTemplate } from "@/features/professions/schema";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatDate, formatDateTime } from "@/lib/time";

import type { DashboardOrder, DashboardSummary } from "./summary";

export type AlertKey =
  "late" | "due_soon" | "to_collect" | "quotes_waiting" | "unassigned";

export type DashboardAlert = {
  key: AlertKey;
  tone: "danger" | "warning" | "info";
  /** Ex. « 3 commandes à remettre sous 48 h ». */
  title: string;
  /** Fondement de l'alerte : règle, dates et états pris en compte. */
  basis: string;
  items: { id: string; href: string; primary: string; secondary: string }[];
  count: number;
  more?: { href: string; label: string };
};

/** « 1 commande », « 3 commandes ». */
export function plural(n: number, singular: string, pluralForm?: string) {
  return `${n} ${n > 1 ? (pluralForm ?? `${singular}s`) : singular}`;
}

function orderItem(
  order: DashboardOrder,
  secondary: string,
): DashboardAlert["items"][number] {
  return {
    id: order.id,
    href: `/dashboard/orders/${order.id}`,
    primary: `${order.code} · ${order.customerName}`,
    secondary,
  };
}

/**
 * Alertes déterministes du tableau « Aujourd'hui » (§5.9) : chacune dit sur
 * quoi elle repose et renvoie vers les vrais dossiers. Aucune estimation.
 */
export function buildAlerts(
  summary: DashboardSummary,
  options: {
    template?: ProfessionTemplate;
    quotesEnabled: boolean;
    teamSize: number;
  },
): DashboardAlert[] {
  const { template } = options;
  const alerts: DashboardAlert[] = [];
  const { dueHours, quoteDays } = summary.thresholds;
  const state = (order: DashboardOrder) => statusLabel(order.status, template);

  if (summary.late.count) {
    alerts.push({
      key: "late",
      tone: "danger",
      title: `${plural(summary.late.count, "commande")} en retard`,
      basis:
        "Échéance dépassée pour une commande qui n'est ni remise, ni clôturée, ni annulée.",
      count: summary.late.count,
      items: summary.late.items.map((order) =>
        orderItem(
          order,
          `Échéance : ${order.dueAt ? formatDateTime(order.dueAt) : "—"} · ${state(order)}`,
        ),
      ),
      more: {
        href: "/dashboard/orders?filtre=late",
        label: "Toutes les commandes en retard",
      },
    });
  }

  if (summary.dueSoon.count) {
    alerts.push({
      key: "due_soon",
      tone: "warning",
      title: `${plural(summary.dueSoon.count, "commande")} à remettre sous ${dueHours} h`,
      basis: `Échéance dans les ${dueHours} prochaines heures, commande pas encore remise.`,
      count: summary.dueSoon.count,
      items: summary.dueSoon.items.map((order) =>
        orderItem(
          order,
          `Pour : ${order.dueAt ? formatDateTime(order.dueAt) : "—"} · ${state(order)}`,
        ),
      ),
      more: {
        href: "/dashboard/orders?filtre=soon",
        label: `Toutes les commandes sous ${dueHours} h`,
      },
    });
  }

  if (summary.toCollect.count) {
    alerts.push({
      key: "to_collect",
      tone: "info",
      title: `${plural(summary.toCollect.count, "solde")} en attente`,
      basis: `Reste à payer sur des commandes confirmées (brouillons et annulées exclus), d'après les encaissements enregistrés. Total : ${formatXaf(summary.toCollect.total)}.`,
      count: summary.toCollect.count,
      items: summary.toCollect.items.map((order) =>
        orderItem(order, `Reste ${formatXaf(order.balance)} · ${state(order)}`),
      ),
      more: {
        href: "/dashboard/orders?filtre=to_collect",
        label: "Tous les soldes",
      },
    });
  }

  if (options.quotesEnabled && summary.quotesWaiting.count) {
    alerts.push({
      key: "quotes_waiting",
      tone: "info",
      title: `${plural(summary.quotesWaiting.count, "devis", "devis")} ${summary.quotesWaiting.count > 1 ? "envoyés" : "envoyé"} sans réponse depuis ${quoteDays} jours`,
      basis: `Devis marqué « envoyé » il y a plus de ${quoteDays} jours, sans acceptation ni refus enregistrés.`,
      count: summary.quotesWaiting.count,
      items: summary.quotesWaiting.items.map((quote) => ({
        id: quote.id,
        href: `/dashboard/quotes/${quote.id}`,
        primary: `${quote.code} · ${quote.customerName}`,
        secondary: `Envoyé le ${formatDate(quote.sentAt)} · ${formatXaf(quote.total)}`,
      })),
      more: { href: "/dashboard/quotes", label: "Tous les devis en cours" },
    });
  }

  // Sans équipe, « sans responsable » n'a pas de sens.
  if (options.teamSize > 1 && summary.unassigned.count) {
    alerts.push({
      key: "unassigned",
      tone: "info",
      title: `${plural(summary.unassigned.count, "commande")} sans responsable`,
      basis: "Commande en cours sans membre de l'équipe désigné.",
      count: summary.unassigned.count,
      items: summary.unassigned.items.map((order) =>
        orderItem(
          order,
          `${order.dueAt ? `Pour : ${formatDateTime(order.dueAt)} · ` : ""}${state(order)}`,
        ),
      ),
      more: {
        href: "/dashboard/orders?filtre=unassigned",
        label: "Toutes les commandes sans responsable",
      },
    });
  }

  return alerts;
}
