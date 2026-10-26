import "server-only";

import { z } from "zod";

import { toAmount, type OrderItem } from "@/features/orders/queries";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

import type { QuoteStatus } from "./status";

export const QUOTE_FILTERS = ["open", "accepted", "closed", "all"] as const;
export type QuoteFilter = (typeof QUOTE_FILTERS)[number];

export function isQuoteFilter(value: unknown): value is QuoteFilter {
  return (
    typeof value === "string" &&
    (QUOTE_FILTERS as readonly string[]).includes(value)
  );
}

const FILTER_STATUSES: Record<QuoteFilter, QuoteStatus[] | null> = {
  open: ["draft", "sent"],
  accepted: ["accepted"],
  closed: ["rejected", "expired", "cancelled"],
  all: null,
};

export type QuoteListItem = {
  id: string;
  code: string;
  status: QuoteStatus;
  customerName: string;
  total: string;
  validUntil: string | null;
  orderId: string | null;
  createdAt: string;
};

const PAGE_SIZE = 20;

type CustomerJoin =
  | {
      id: string;
      name: string;
      phone_e164: string | null;
      email?: string | null;
    }
  | {
      id: string;
      name: string;
      phone_e164: string | null;
      email?: string | null;
    }[];

const one = <T>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value);

export async function listQuotes(
  businessId: string,
  options: { filter?: QuoteFilter; customerId?: string; cursor?: string },
): Promise<{ quotes: QuoteListItem[]; nextCursor: string | null }> {
  const decoded = decodeCursor(options.cursor, ["at", "id"] as const);
  const after =
    decoded &&
    z.uuid().safeParse(decoded.id).success &&
    !Number.isNaN(Date.parse(decoded.at))
      ? decoded
      : null;
  const supabase = await createClient();
  let request = supabase
    .from("quotes")
    .select(
      "id, code, status, total, valid_until, order_id, created_at, customers!inner(id, name, phone_e164)",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  const statuses = FILTER_STATUSES[options.filter ?? "open"];
  if (statuses) request = request.in("status", statuses);
  if (options.customerId)
    request = request.eq("customer_id", options.customerId);
  if (after) {
    request = request.or(
      `created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`,
    );
  }
  const { data, error } = await request;
  if (error) throw new Error("Impossible de charger les devis.");

  const rows = data ?? [];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    quotes: page.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      customerName: one(row.customers as CustomerJoin).name,
      total: toAmount(row.total),
      validUntil: row.valid_until,
      orderId: row.order_id,
      createdAt: row.created_at,
    })),
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? encodeCursor({ at: last.created_at, id: last.id })
        : null,
  };
}

export type QuoteDetail = {
  id: string;
  code: string;
  status: QuoteStatus;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  validUntil: string | null;
  conditions: string | null;
  notes: string | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  version: number;
  sentAt: string | null;
  decidedAt: string | null;
  decidedBy: string | null;
  acceptanceSource: "manual" | "link" | null;
  decisionNote: string | null;
  orderId: string | null;
  orderCode: string | null;
  createdBy: string | null;
  createdAt: string;
  items: OrderItem[];
};

export const quantityText = (value: number | string) =>
  String(value).replace(/\.?0+$/, "") || "0";

export async function getQuote(
  businessId: string,
  id: string,
): Promise<QuoteDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select(
      "id, code, status, valid_until, conditions, notes, subtotal, tax_total, total, version, sent_at, decided_at, decided_by, acceptance_source, decision_note, order_id, created_by, created_at, customers!inner(id, name, phone_e164, email), orders(code)",
    )
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!quote) return null;

  const { data: items } = await supabase
    .from("quote_items")
    .select(
      "id, position, catalog_item_id, name, unit, quantity, unit_price, discount, tax_rate, line_net, line_tax",
    )
    .eq("quote_id", id)
    .order("position");

  const customer = one(quote.customers as CustomerJoin);
  const order = quote.orders
    ? one(quote.orders as { code: string } | { code: string }[])
    : null;
  return {
    id: quote.id,
    code: quote.code,
    status: quote.status,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone_e164,
      email: customer.email ?? null,
    },
    validUntil: quote.valid_until,
    conditions: quote.conditions,
    notes: quote.notes,
    subtotal: toAmount(quote.subtotal),
    taxTotal: toAmount(quote.tax_total),
    total: toAmount(quote.total),
    version: quote.version,
    sentAt: quote.sent_at,
    decidedAt: quote.decided_at,
    decidedBy: quote.decided_by,
    acceptanceSource: quote.acceptance_source,
    decisionNote: quote.decision_note,
    orderId: quote.order_id,
    orderCode: order?.code ?? null,
    createdBy: quote.created_by,
    createdAt: quote.created_at,
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
  };
}
