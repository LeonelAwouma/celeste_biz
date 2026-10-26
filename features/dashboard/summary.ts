import type { OrderState } from "@/features/professions/schema";

/** Montant JSON (nombre ou chaîne) → chaîne décimale à 2 chiffres. */
const amount = (value: unknown) =>
  typeof value === "number"
    ? value.toFixed(2)
    : typeof value === "string"
      ? value
      : "0.00";
const count = (value: unknown) => (typeof value === "number" ? value : 0);
const text = (value: unknown) => (typeof value === "string" ? value : null);

export type DashboardOrder = {
  id: string;
  code: string;
  status: OrderState;
  customerName: string;
  dueAt: string | null;
  balance: string;
};

export type DashboardQuote = {
  id: string;
  code: string;
  customerName: string;
  sentAt: string;
  validUntil: string | null;
  total: string;
};

export type DashboardSummary = {
  generatedAt: string;
  today: string;
  thresholds: { dueHours: number; quoteDays: number };
  hasOrders: boolean;
  activeCount: number;
  draftCount: number;
  dueSoon: { count: number; items: DashboardOrder[] };
  late: { count: number; items: DashboardOrder[] };
  toCollect: { count: number; total: string; items: DashboardOrder[] };
  unassigned: { count: number; items: DashboardOrder[] };
  quotesWaiting: { count: number; items: DashboardQuote[] };
  payments: {
    week: { from: string; to: string; count: number; total: string };
    month: { from: string; to: string; count: number; total: string };
  };
};

type Json = Record<string, unknown>;
const obj = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
const list = (value: unknown): Json[] =>
  Array.isArray(value) ? (value as Json[]) : [];

const order = (row: Json): DashboardOrder => ({
  id: String(row.id),
  code: String(row.code),
  status: row.status as OrderState,
  customerName: String(row.customer_name ?? ""),
  dueAt: text(row.due_at),
  balance: amount(row.balance),
});

/** Réponse de `dashboard_summary` (jsonb) → objet typé. */
export function parseDashboardSummary(raw: unknown): DashboardSummary {
  const data = obj(raw);
  const thresholds = obj(data.thresholds);
  const group = (key: string) => obj(data[key]);
  const payments = obj(data.payments);
  const period = (key: string) => {
    const p = obj(payments[key]);
    return {
      from: String(p.from ?? ""),
      to: String(p.to ?? ""),
      count: count(p.count),
      total: amount(p.total),
    };
  };
  return {
    generatedAt: String(data.generated_at ?? ""),
    today: String(data.today ?? ""),
    thresholds: {
      dueHours: count(thresholds.due_hours) || 48,
      quoteDays: count(thresholds.quote_days) || 5,
    },
    hasOrders: data.has_orders === true,
    activeCount: count(data.active_count),
    draftCount: count(data.draft_count),
    dueSoon: {
      count: count(group("due_soon").count),
      items: list(group("due_soon").items).map(order),
    },
    late: {
      count: count(group("late").count),
      items: list(group("late").items).map(order),
    },
    toCollect: {
      count: count(group("to_collect").count),
      total: amount(group("to_collect").total),
      items: list(group("to_collect").items).map(order),
    },
    unassigned: {
      count: count(group("unassigned").count),
      items: list(group("unassigned").items).map(order),
    },
    quotesWaiting: {
      count: count(group("quotes_waiting").count),
      items: list(group("quotes_waiting").items).map((row) => ({
        id: String(row.id),
        code: String(row.code),
        customerName: String(row.customer_name ?? ""),
        sentAt: String(row.sent_at ?? ""),
        validUntil: text(row.valid_until),
        total: amount(row.total),
      })),
    },
    payments: { week: period("week"), month: period("month") },
  };
}
