import "server-only";

import { z } from "zod";

import { toAmount, type OrderItem } from "@/features/orders/queries";
import { quantityText } from "@/features/quotes/queries";
import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

import {
  readFiscalProfile,
  type FiscalProfile,
  type InvoiceStatus,
} from "./schemas";

const one = <T>(value: T | T[]): T => (Array.isArray(value) ? value[0] : value);

export type InvoiceListItem = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  customerName: string;
  orderCode: string | null;
  total: string;
  issueDate: string | null;
  createdAt: string;
};

const PAGE_SIZE = 20;
const LIST_COLUMNS =
  "id, number, status, total, issue_date, created_at, customers!inner(name), orders(code)";

type ListRow = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  total: number;
  issue_date: string | null;
  created_at: string;
  customers: { name: string } | { name: string }[];
  orders: { code: string } | { code: string }[] | null;
};

const toListItem = (row: ListRow): InvoiceListItem => ({
  id: row.id,
  number: row.number,
  status: row.status,
  customerName: one(row.customers).name,
  orderCode: row.orders ? one(row.orders).code : null,
  total: toAmount(row.total),
  issueDate: row.issue_date,
  createdAt: row.created_at,
});

export async function listInvoices(
  businessId: string,
  options: { cursor?: string } = {},
): Promise<{ invoices: InvoiceListItem[]; nextCursor: string | null }> {
  const decoded = decodeCursor(options.cursor, ["at", "id"] as const);
  const after =
    decoded &&
    z.uuid().safeParse(decoded.id).success &&
    !Number.isNaN(Date.parse(decoded.at))
      ? decoded
      : null;
  const supabase = await createClient();
  let request = supabase
    .from("invoices")
    .select(LIST_COLUMNS)
    .eq("business_id", businessId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (after) {
    request = request.or(
      `created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`,
    );
  }
  const { data, error } = await request;
  if (error) throw new Error("Impossible de charger les factures.");
  const rows = (data ?? []) as ListRow[];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    invoices: page.map(toListItem),
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? encodeCursor({ at: last.created_at, id: last.id })
        : null,
  };
}

export async function listOrderInvoices(businessId: string, orderId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(LIST_COLUMNS)
    .eq("business_id", businessId)
    .eq("order_id", orderId)
    .neq("status", "discarded")
    .order("created_at", { ascending: false });
  return ((data ?? []) as ListRow[]).map(toListItem);
}

export type CreditNote = {
  id: string;
  number: string;
  reason: string;
  amount: string;
  issueDate: string;
  issuedBy: string | null;
};

export type InvoiceDetail = {
  id: string;
  number: string | null;
  status: InvoiceStatus;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  order: { id: string; code: string } | null;
  issueDate: string | null;
  dueDate: string | null;
  conditions: string | null;
  seller: Record<string, unknown> | null;
  buyer: Record<string, unknown> | null;
  subtotal: string;
  taxTotal: string;
  total: string;
  version: number;
  issuedAt: string | null;
  issuedBy: string | null;
  pdfPath: string | null;
  createdAt: string;
  items: OrderItem[];
  creditNotes: CreditNote[];
};

export async function getInvoice(
  businessId: string,
  id: string,
): Promise<InvoiceDetail | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, number, status, issue_date, due_date, conditions, seller, buyer, subtotal, tax_total, total, version, issued_at, issued_by, pdf_path, created_at, customers!inner(id, name, phone_e164, email), orders(id, code)",
    )
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  if (!invoice) return null;

  const [{ data: items }, { data: notes }] = await Promise.all([
    supabase
      .from("invoice_items")
      .select(
        "id, position, name, unit, quantity, unit_price, discount, tax_rate, line_net, line_tax",
      )
      .eq("invoice_id", id)
      .order("position"),
    supabase
      .from("credit_notes")
      .select("id, number, reason, amount, issue_date, issued_by")
      .eq("invoice_id", id)
      .order("issued_at"),
  ]);

  type CustomerRow = {
    id: string;
    name: string;
    phone_e164: string | null;
    email: string | null;
  };
  type OrderRow = { id: string; code: string };
  const customer = one(invoice.customers as CustomerRow | CustomerRow[]);
  const order = invoice.orders
    ? one(invoice.orders as OrderRow | OrderRow[])
    : null;
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone_e164,
      email: customer.email,
    },
    order,
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    conditions: invoice.conditions,
    seller: invoice.seller,
    buyer: invoice.buyer,
    subtotal: toAmount(invoice.subtotal),
    taxTotal: toAmount(invoice.tax_total),
    total: toAmount(invoice.total),
    version: invoice.version,
    issuedAt: invoice.issued_at,
    issuedBy: invoice.issued_by,
    pdfPath: invoice.pdf_path,
    createdAt: invoice.created_at,
    items: (items ?? []).map((item) => ({
      id: item.id,
      position: item.position,
      catalogItemId: null,
      name: item.name,
      unit: item.unit,
      quantity: quantityText(item.quantity),
      unitPrice: toAmount(item.unit_price),
      discount: toAmount(item.discount),
      taxRate: quantityText(item.tax_rate),
      lineNet: toAmount(item.line_net),
      lineTax: toAmount(item.line_tax),
    })),
    creditNotes: (notes ?? []).map((note) => ({
      id: note.id,
      number: note.number,
      reason: note.reason,
      amount: toAmount(note.amount),
      issueDate: note.issue_date,
      issuedBy: note.issued_by,
    })),
  };
}

export type SellerProfile = {
  name: string;
  city: string | null;
  phone: string | null;
  fiscal: FiscalProfile;
};

/** Vendeur actuel (nom commercial, ville, WhatsApp, profil de facturation). */
export async function getSellerProfile(
  businessId: string,
): Promise<SellerProfile> {
  const supabase = await createClient();
  const [{ data: business }, { data: settings }] = await Promise.all([
    supabase
      .from("businesses")
      .select("name, city, whatsapp_phone_e164")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("business_settings")
      .select("fiscal_profile")
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);
  return {
    name: business?.name ?? "",
    city: business?.city ?? null,
    phone: business?.whatsapp_phone_e164 ?? null,
    fiscal: readFiscalProfile(settings?.fiscal_profile),
  };
}

/** Émission possible seulement si l'interrupteur plateforme est actif. */
export async function isIssueEnabledInDatabase(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("fiscal_invoice_issue_enabled");
  return data === true;
}
