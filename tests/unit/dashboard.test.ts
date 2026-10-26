import { describe, expect, it } from "vitest";

import { buildAlerts, plural } from "@/features/dashboard/alerts";
import { parseDashboardSummary } from "@/features/dashboard/summary";
import { getProfessionTemplate } from "@/features/professions/registry";
import { formatXaf } from "@/lib/monetary/xaf";

const raw = {
  generated_at: "2026-10-26T08:00:00+00:00",
  today: "2026-10-26",
  thresholds: { due_hours: 48, quote_days: 5 },
  has_orders: true,
  active_count: 4,
  draft_count: 1,
  due_soon: {
    count: 1,
    items: [
      {
        id: "o1",
        code: "CMD-2026-0001",
        status: "in_progress",
        customer_name: "Mireille Ngo",
        due_at: "2026-10-27T17:00:00+00:00",
        balance: 20000,
      },
    ],
  },
  late: {
    count: 7,
    items: [
      {
        id: "o2",
        code: "CMD-2026-0002",
        status: "ready",
        customer_name: "Paul Etoga",
        due_at: "2026-10-25T17:00:00+00:00",
        balance: 5000,
      },
    ],
  },
  to_collect: {
    count: 2,
    total: 25000,
    items: [
      {
        id: "o2",
        code: "CMD-2026-0002",
        status: "ready",
        customer_name: "Paul Etoga",
        due_at: null,
        balance: 5000.5,
        total: 5000.5,
      },
    ],
  },
  unassigned: { count: 0, items: [] },
  quotes_waiting: {
    count: 1,
    items: [
      {
        id: "q1",
        code: "DEV-2026-0001",
        customer_name: "Paul Etoga",
        sent_at: "2026-10-20T09:00:00+00:00",
        valid_until: "2026-11-05",
        total: 82000,
      },
    ],
  },
  payments: {
    week: { from: "2026-10-20", to: "2026-10-26", count: 1, total: 15000 },
    month: { from: "2026-10-01", to: "2026-10-26", count: 2, total: 40000 },
  },
};

describe("résumé du tableau de bord", () => {
  it("convertit les montants JSON en chaînes décimales", () => {
    const summary = parseDashboardSummary(raw);
    expect(summary.toCollect.total).toBe("25000.00");
    expect(summary.toCollect.items[0].balance).toBe("5000.50");
    expect(summary.payments.month).toEqual({
      from: "2026-10-01",
      to: "2026-10-26",
      count: 2,
      total: "40000.00",
    });
    expect(summary.late.items[0]).toMatchObject({
      code: "CMD-2026-0002",
      customerName: "Paul Etoga",
      status: "ready",
    });
  });

  it("résiste à une réponse vide ou partielle", () => {
    const summary = parseDashboardSummary(null);
    expect(summary.hasOrders).toBe(false);
    expect(summary.late).toEqual({ count: 0, items: [] });
    expect(summary.thresholds).toEqual({ dueHours: 48, quoteDays: 5 });
    expect(summary.toCollect.total).toBe("0.00");
  });
});

describe("alertes", () => {
  const template = getProfessionTemplate("couture", 1);
  const summary = parseDashboardSummary(raw);

  it("pluriel simple", () => {
    expect(plural(1, "commande")).toBe("1 commande");
    expect(plural(3, "commande")).toBe("3 commandes");
    expect(plural(2, "devis", "devis")).toBe("2 devis");
  });

  it("ordre : retard, sous 48 h, soldes, devis ; fondement et liens réels", () => {
    const alerts = buildAlerts(summary, {
      template,
      quotesEnabled: true,
      teamSize: 2,
    });
    expect(alerts.map((a) => a.key)).toEqual([
      "late",
      "due_soon",
      "to_collect",
      "quotes_waiting",
    ]);
    const late = alerts[0];
    expect(late.title).toBe("7 commandes en retard");
    expect(late.basis).toMatch(/Échéance dépassée/);
    expect(late.items[0].href).toBe("/dashboard/orders/o2");
    expect(late.items[0].secondary).toMatch(/^Échéance : .+ · \S/);
    expect(late.more?.href).toBe("/dashboard/orders?filtre=late");

    expect(alerts[1].title).toBe("1 commande à remettre sous 48 h");
    // Libellé d'état propre au métier (couture : « En confection »).
    expect(alerts[1].items[0].secondary).toContain("En confection");
    expect(alerts[2].basis).toContain(formatXaf("25000.00"));
    expect(alerts[3].title).toBe("1 devis envoyé sans réponse depuis 5 jours");
    expect(alerts[3].items[0].href).toBe("/dashboard/quotes/q1");
  });

  it("devis masqués si le module est désactivé ; « sans responsable » seulement en équipe", () => {
    const withUnassigned = parseDashboardSummary({
      ...raw,
      unassigned: { count: 1, items: [raw.late.items[0]] },
    });
    expect(
      buildAlerts(withUnassigned, { quotesEnabled: false, teamSize: 1 }).map(
        (a) => a.key,
      ),
    ).toEqual(["late", "due_soon", "to_collect"]);
    expect(
      buildAlerts(withUnassigned, { quotesEnabled: false, teamSize: 3 }).map(
        (a) => a.key,
      ),
    ).toContain("unassigned");
  });

  it("aucune alerte quand rien n'est à faire", () => {
    expect(
      buildAlerts(parseDashboardSummary({ has_orders: true }), {
        quotesEnabled: true,
        teamSize: 2,
      }),
    ).toEqual([]);
  });
});
