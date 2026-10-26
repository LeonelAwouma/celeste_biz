import "server-only";

import { z } from "zod";

import type { OrderState } from "@/features/professions/schema";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

import type { PaymentMethod, PaymentStatus } from "./status";

export const ORDER_FILTERS = [
  "active",
  "late",
  "to_collect",
  "draft",
  "done",
  "all",
] as const;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export function isOrderFilter(value: unknown): value is OrderFilter {
  return (
    typeof value === "string" &&
    (ORDER_FILTERS as readonly string[]).includes(value)
  );
}

/** Montant `numeric` reçu de l'API (nombre JSON) → chaîne décimale. */
export function toAmount(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  return typeof value === "number" ? value.toFixed(2) : value;
}

export type OrderListItem = {
  id: string;
  code: string;
  status: OrderState;
  customerId: string;
  customerName: string;
  dueAt: string | null;
  total: string;
  paidTotal: string;
  balance: string;
  createdAt: string;
};

const PAGE_SIZE = 20;

export async function listOrders(
  businessId: string,
  options: {
    filter?: OrderFilter;
    query?: string;
    customerId?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<{ orders: OrderListItem[]; nextCursor: string | null }> {
  const filter = options.filter ?? "active";
  const decoded = decodeCursor(options.cursor, ["at", "id"] as const);
  const after =
    decoded &&
    z.uuid().safeParse(decoded.id).success &&
    !Number.isNaN(Date.parse(decoded.at))
      ? decoded
      : null;
  const limit = options.limit ?? PAGE_SIZE;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_orders", {
    p_business_id: businessId,
    p_filter: filter,
    p_query: options.query?.trim() || null,
    p_customer_id: options.customerId ?? null,
    p_after_at: after?.at ?? null,
    p_after_id: after?.id ?? null,
    p_limit: limit + 1,
  });
  if (error) throw new Error("Impossible de charger les commandes.");

  const rows = (data ?? []) as {
    id: string;
    code: string;
    status: OrderState;
    customer_id: string;
    customer_name: string;
    due_at: string | null;
    total: number;
    paid_total: number;
    balance: number;
    created_at: string;
  }[];
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    orders: page.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      customerId: row.customer_id,
      customerName: row.customer_name,
      dueAt: row.due_at,
      total: toAmount(row.total),
      paidTotal: toAmount(row.paid_total),
      balance: toAmount(row.balance),
      createdAt: row.created_at,
    })),
    nextCursor:
      rows.length > limit && last
        ? encodeCursor({
            at: (filter === "late" ? last.due_at : last.created_at) ?? "",
            id: last.id,
          })
        : null,
  };
}

export type OrderItem = {
  id: string;
  position: number;
  catalogItemId: string | null;
  name: string;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  lineNet: string;
  lineTax: string;
};

export type Payment = {
  id: string;
  method: PaymentMethod;
  amount: string;
  status: PaymentStatus;
  paidOn: string;
  reference: string | null;
  note: string | null;
  recordedBy: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
};

export type OrderEvent = {
  id: number;
  actorId: string | null;
  type:
    | "created"
    | "updated"
    | "status_changed"
    | "payment_recorded"
    | "payment_cancelled";
  fromStatus: OrderState | null;
  toStatus: OrderState | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OrderDetail = {
  id: string;
  code: string;
  status: OrderState;
  customer: { id: string; name: string; phone: string | null };
  professionKey: string;
  professionVersion: number;
  details: Record<string, unknown>;
  productionStep: string | null;
  dueAt: string | null;
  assigneeId: string | null;
  notes: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  paidTotal: string;
  balance: string;
  version: number;
  cancelReason: string | null;
  createdBy: string | null;
  createdAt: string;
  items: OrderItem[];
  payments: Payment[];
  events: OrderEvent[];
};

const quantityText = (value: number | string) =>
  String(value).replace(/\.?0+$/, "") || "0";

export async function getOrder(
  businessId: string,
  id: string,
): Promise<OrderDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, code, status, profession_key, profession_version, details, production_step, due_at, assignee_id, notes, subtotal, tax_total, total, paid_total, balance, version, cancel_reason, created_by, created_at, customers!inner(id, name, phone_e164)",
    )
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!order) return null;

  const [{ data: items }, { data: payments }, { data: events }] =
    await Promise.all([
      supabase
        .from("order_items")
        .select(
          "id, position, catalog_item_id, name, unit, quantity, unit_price, discount, tax_rate, line_net, line_tax",
        )
        .eq("order_id", id)
        .order("position"),
      supabase
        .from("payments")
        .select(
          "id, method, amount, status, paid_on, reference, note, recorded_by, cancelled_at, cancel_reason, created_at",
        )
        .eq("order_id", id)
        .order("created_at"),
      supabase
        .from("order_events")
        .select(
          "id, actor_id, type, from_status, to_status, metadata, created_at",
        )
        .eq("order_id", id)
        .order("id", { ascending: false })
        .limit(100),
    ]);

  const customer = Array.isArray(order.customers)
    ? order.customers[0]
    : order.customers;
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone_e164,
    },
    professionKey: order.profession_key,
    professionVersion: order.profession_version,
    details: (order.details ?? {}) as Record<string, unknown>,
    productionStep: order.production_step,
    dueAt: order.due_at,
    assigneeId: order.assignee_id,
    notes: order.notes,
    subtotal: toAmount(order.subtotal),
    taxTotal: toAmount(order.tax_total),
    total: toAmount(order.total),
    paidTotal: toAmount(order.paid_total),
    balance: toAmount(order.balance),
    version: order.version,
    cancelReason: order.cancel_reason,
    createdBy: order.created_by,
    createdAt: order.created_at,
    items: (items ?? []).map((item) => ({
      id: item.id,
      position: item.position,
      catalogItemId: item.catalog_item_id,
      name: item.name,
      unit: item.unit,
      quantity: quantityText(item.quantity),
      unitPrice: toAmount(item.unit_price),
      discount: toAmount(item.discount),
      taxRate: quantityText(item.tax_rate),
      lineNet: toAmount(item.line_net),
      lineTax: toAmount(item.line_tax),
    })),
    payments: (payments ?? []).map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: toAmount(payment.amount),
      status: payment.status,
      paidOn: payment.paid_on,
      reference: payment.reference,
      note: payment.note,
      recordedBy: payment.recorded_by,
      cancelledAt: payment.cancelled_at,
      cancelReason: payment.cancel_reason,
      createdAt: payment.created_at,
    })),
    events: (events ?? []).map((event) => ({
      id: event.id,
      actorId: event.actor_id,
      type: event.type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      metadata: (event.metadata ?? {}) as Record<string, unknown>,
      createdAt: event.created_at,
    })),
  };
}

/** Résumé pour la fiche client : nombre de commandes et solde total dû. */
export async function getCustomerBalance(
  businessId: string,
  customerId: string,
) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("balance, status")
    .eq("business_id", businessId)
    .eq("customer_id", customerId);
  const open = (data ?? []).filter(
    (row) => row.status !== "cancelled" && row.status !== "draft",
  );
  const cents = open.reduce(
    (sum, row) => sum + Math.round(Number(row.balance) * 100),
    0,
  );
  return { count: (data ?? []).length, balance: (cents / 100).toFixed(2) };
}
