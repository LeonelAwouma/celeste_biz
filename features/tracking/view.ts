import type { OrderState } from "@/features/professions/schema";

type Json = Record<string, unknown>;
const obj = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
const list = (value: unknown): Json[] =>
  Array.isArray(value) ? (value as Json[]) : [];
const text = (value: unknown) => (typeof value === "string" ? value : null);
const amount = (value: unknown) =>
  typeof value === "number"
    ? value.toFixed(2)
    : typeof value === "string"
      ? value
      : "0.00";

/** 2.500 → « 2.5 », 10 → « 10 » (zéros retirés après la virgule seulement). */
const quantity = (value: unknown) => {
  const raw = String(value ?? "0");
  return raw.includes(".")
    ? raw.replace(/0+$/, "").replace(/\.$/, "") || "0"
    : raw;
};

export type TrackingView =
  | { state: "not_found" }
  | {
      state: "expired" | "revoked";
      businessName: string;
      businessPhone: string | null;
    }
  | {
      state: "valid";
      expiresAt: string;
      businessName: string;
      businessPhone: string | null;
      businessCity: string | null;
      professionKey: string;
      professionVersion: number;
      order: {
        code: string;
        status: OrderState;
        dueAt: string | null;
        productionStep: string | null;
        updatedAt: string;
        customerName: string;
      };
      items: { name: string; unit: string | null; quantity: string }[];
      amounts: { total: string; paidTotal: string; balance: string } | null;
      history: { toStatus: OrderState; at: string }[];
      documents: {
        receipts: { id: string; paidOn: string; amount: string }[];
        invoices: { id: string; number: string; issueDate: string }[];
      } | null;
    };

/** Réponse de `get_tracking_view` → objet typé (aucune autre donnée). */
export function parseTrackingView(raw: unknown): TrackingView {
  const data = obj(raw);
  const state = data.state;
  if (state === "expired" || state === "revoked") {
    return {
      state,
      businessName: String(data.business_name ?? ""),
      businessPhone: text(data.business_phone),
    };
  }
  if (state !== "valid") return { state: "not_found" };

  const order = obj(data.order);
  const amounts = data.amounts ? obj(data.amounts) : null;
  const documents = data.documents ? obj(data.documents) : null;
  return {
    state: "valid",
    expiresAt: String(data.expires_at ?? ""),
    businessName: String(data.business_name ?? ""),
    businessPhone: text(data.business_phone),
    businessCity: text(data.business_city),
    professionKey: String(data.profession_key ?? ""),
    professionVersion: Number(data.profession_version ?? 1),
    order: {
      code: String(order.code ?? ""),
      status: order.status as OrderState,
      dueAt: text(order.due_at),
      productionStep: text(order.production_step),
      updatedAt: String(order.updated_at ?? ""),
      customerName: String(order.customer_name ?? ""),
    },
    items: list(data.items).map((item) => ({
      name: String(item.name ?? ""),
      unit: text(item.unit),
      quantity: quantity(item.quantity),
    })),
    amounts: amounts
      ? {
          total: amount(amounts.total),
          paidTotal: amount(amounts.paid_total),
          balance: amount(amounts.balance),
        }
      : null,
    history: list(data.history).map((entry) => ({
      toStatus: entry.to_status as OrderState,
      at: String(entry.at ?? ""),
    })),
    documents: documents
      ? {
          receipts: list(documents.receipts).map((r) => ({
            id: String(r.id),
            paidOn: String(r.paid_on ?? ""),
            amount: amount(r.amount),
          })),
          invoices: list(documents.invoices).map((i) => ({
            id: String(i.id),
            number: String(i.number ?? ""),
            issueDate: String(i.issue_date ?? ""),
          })),
        }
      : null,
  };
}

/** Jeton au format attendu (évite un appel réseau pour une URL fantaisiste). */
export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
