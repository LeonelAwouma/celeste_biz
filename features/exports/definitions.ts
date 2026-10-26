import "server-only";

import { getProfessionTemplate } from "@/features/professions/registry";
import {
  ITEM_KIND_LABELS,
  PRICE_MODE_LABELS,
} from "@/features/catalog/schemas";
import { INVOICE_STATUS_LABELS } from "@/features/invoices/schemas";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  statusLabel,
} from "@/features/orders/status";
import type { OrderState } from "@/features/professions/schema";
import { QUOTE_STATUS_LABELS } from "@/features/quotes/status";
import { amount, type CsvCell } from "@/lib/csv";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { isoToLocalParts } from "@/lib/time";

export const EXPORT_KINDS = [
  "customers",
  "catalog",
  "orders",
  "payments",
  "quotes",
  "invoices",
] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: unknown): value is ExportKind {
  return (EXPORT_KINDS as readonly unknown[]).includes(value);
}

export const EXPORT_LABELS: Record<ExportKind, string> = {
  customers: "Clients",
  catalog: "Catalogue",
  orders: "Commandes",
  payments: "Encaissements",
  quotes: "Devis",
  invoices: "Factures",
};

/** Plafond par export : au-delà, réduire la période. */
export const EXPORT_MAX_ROWS = 20000;
const PAGE = 1000;

export type ExportContext = {
  businessId: string;
  professionKey: string;
  professionVersion: number;
  /** Période inclusive (AAAA-MM-JJ), fuseau de l'entreprise ; null = tout. */
  from: string | null;
  to: string | null;
};

export type ExportResult = {
  headers: string[];
  rows: CsvCell[][];
  truncated: boolean;
};

type Label = { name: string } | { name: string }[] | null;
const nameOf = (value: Label) =>
  (Array.isArray(value) ? value[0]?.name : value?.name) ?? "";

/** « 2026-10-26 14:30 » dans le fuseau de l'entreprise. */
function localDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const { date, time } = isoToLocalParts(iso);
  return `${date} ${time}`;
}

/** Bornes UTC d'une période en dates locales (Afrique/Douala, UTC+1). */
function instantRange(ctx: ExportContext) {
  return {
    from: ctx.from ? `${ctx.from}T00:00:00+01:00` : null,
    to: ctx.to ? `${ctx.to}T23:59:59.999+01:00` : null,
  };
}

async function collect<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let offset = 0; offset < EXPORT_MAX_ROWS + 1; offset += PAGE) {
    const { data, error } = await page(offset, offset + PAGE - 1);
    if (error) throw new Error("Export impossible pour le moment.");
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return {
    rows: rows.slice(0, EXPORT_MAX_ROWS),
    truncated: rows.length > EXPORT_MAX_ROWS,
  };
}

/**
 * Données de l'entreprise uniquement : filtre explicite sur `business_id`,
 * en plus de la RLS qui reste la barrière de référence.
 */
export async function buildExport(
  kind: ExportKind,
  ctx: ExportContext,
): Promise<ExportResult> {
  const supabase = await createClient();
  const range = instantRange(ctx);

  switch (kind) {
    case "customers": {
      const { rows, truncated } = await collect((a, b) => {
        let q = supabase
          .from("customers")
          .select(
            "name, phone_e164, email, notes, marketing_consent, created_at, archived_at",
          )
          .eq("business_id", ctx.businessId);
        if (range.from) q = q.gte("created_at", range.from);
        if (range.to) q = q.lte("created_at", range.to);
        return q.order("created_at").order("id").range(a, b);
      });
      return {
        headers: [
          "Nom",
          "Téléphone",
          "E-mail",
          "Notes",
          "Accord marketing",
          "Créé le",
          "Archivé le",
        ],
        rows: rows.map((r) => [
          r.name,
          r.phone_e164 ? formatPhone(r.phone_e164) : null,
          r.email,
          r.notes,
          r.marketing_consent,
          localDateTime(r.created_at),
          localDateTime(r.archived_at),
        ]),
        truncated,
      };
    }
    case "catalog": {
      const { rows, truncated } = await collect((a, b) =>
        supabase
          .from("catalog_items")
          .select(
            "name, kind, category, price_mode, price, unit, visibility, archived_at",
          )
          .eq("business_id", ctx.businessId)
          .order("category", { nullsFirst: false })
          .order("name")
          .order("id")
          .range(a, b),
      );
      return {
        headers: [
          "Nom",
          "Type",
          "Catégorie",
          "Prix",
          "Mode de prix",
          "Unité",
          "Visibilité",
          "Archivé le",
        ],
        rows: rows.map((r) => [
          r.name,
          ITEM_KIND_LABELS[r.kind as keyof typeof ITEM_KIND_LABELS] ?? r.kind,
          r.category,
          amount(r.price),
          PRICE_MODE_LABELS[r.price_mode as keyof typeof PRICE_MODE_LABELS] ??
            r.price_mode,
          r.unit,
          r.visibility === "public" ? "Publique" : "Privée",
          localDateTime(r.archived_at),
        ]),
        truncated,
      };
    }
    case "orders": {
      const template = getProfessionTemplate(
        ctx.professionKey,
        ctx.professionVersion,
      );
      const { rows, truncated } = await collect((a, b) => {
        let q = supabase
          .from("orders")
          .select(
            "code, status, due_at, subtotal, tax_total, total, paid_total, balance, created_at, closed_at, cancelled_at, customers(name)",
          )
          .eq("business_id", ctx.businessId);
        if (range.from) q = q.gte("created_at", range.from);
        if (range.to) q = q.lte("created_at", range.to);
        return q.order("created_at").order("id").range(a, b);
      });
      return {
        headers: [
          "Numéro",
          "Client",
          "État",
          "Échéance",
          "Sous-total",
          "Taxes",
          "Total",
          "Encaissé",
          "Reste à payer",
          "Créée le",
          "Clôturée le",
          "Annulée le",
        ],
        rows: rows.map((r) => [
          r.code,
          nameOf(r.customers as Label),
          statusLabel(r.status as OrderState, template),
          localDateTime(r.due_at),
          amount(r.subtotal),
          amount(r.tax_total),
          amount(r.total),
          amount(r.paid_total),
          amount(r.balance),
          localDateTime(r.created_at),
          localDateTime(r.closed_at),
          localDateTime(r.cancelled_at),
        ]),
        truncated,
      };
    }
    case "payments": {
      const { rows, truncated } = await collect((a, b) => {
        let q = supabase
          .from("payments")
          .select(
            "paid_on, method, reference, amount, status, created_at, orders(code, customers(name))",
          )
          .eq("business_id", ctx.businessId);
        if (ctx.from) q = q.gte("paid_on", ctx.from);
        if (ctx.to) q = q.lte("paid_on", ctx.to);
        return q.order("paid_on").order("id").range(a, b);
      });
      return {
        headers: [
          "Date",
          "Commande",
          "Client",
          "Moyen",
          "Référence",
          "Montant",
          "Statut",
          "Enregistré le",
        ],
        rows: rows.map((r) => {
          const order = (Array.isArray(r.orders) ? r.orders[0] : r.orders) as {
            code: string;
            customers: Label;
          } | null;
          return [
            r.paid_on,
            order?.code ?? null,
            order ? nameOf(order.customers) : null,
            PAYMENT_METHOD_LABELS[
              r.method as keyof typeof PAYMENT_METHOD_LABELS
            ] ?? r.method,
            r.reference,
            amount(r.amount),
            PAYMENT_STATUS_LABELS[
              r.status as keyof typeof PAYMENT_STATUS_LABELS
            ] ?? r.status,
            localDateTime(r.created_at),
          ];
        }),
        truncated,
      };
    }
    case "quotes": {
      const { rows, truncated } = await collect((a, b) => {
        let q = supabase
          .from("quotes")
          .select(
            "code, status, valid_until, subtotal, tax_total, total, sent_at, decided_at, created_at, customers(name)",
          )
          .eq("business_id", ctx.businessId);
        if (range.from) q = q.gte("created_at", range.from);
        if (range.to) q = q.lte("created_at", range.to);
        return q.order("created_at").order("id").range(a, b);
      });
      return {
        headers: [
          "Numéro",
          "Client",
          "État",
          "Valable jusqu'au",
          "Sous-total",
          "Taxes",
          "Total",
          "Envoyé le",
          "Réponse le",
          "Créé le",
        ],
        rows: rows.map((r) => [
          r.code,
          nameOf(r.customers as Label),
          QUOTE_STATUS_LABELS[r.status as keyof typeof QUOTE_STATUS_LABELS] ??
            r.status,
          r.valid_until,
          amount(r.subtotal),
          amount(r.tax_total),
          amount(r.total),
          localDateTime(r.sent_at),
          localDateTime(r.decided_at),
          localDateTime(r.created_at),
        ]),
        truncated,
      };
    }
    case "invoices": {
      const { rows, truncated } = await collect((a, b) => {
        let q = supabase
          .from("invoices")
          .select(
            "number, status, issue_date, due_date, subtotal, tax_total, total, created_at, customers(name), orders(code)",
          )
          .eq("business_id", ctx.businessId)
          .neq("status", "discarded");
        if (range.from) q = q.gte("created_at", range.from);
        if (range.to) q = q.lte("created_at", range.to);
        return q.order("created_at").order("id").range(a, b);
      });
      return {
        headers: [
          "Numéro",
          "Statut",
          "Date d'émission",
          "Échéance",
          "Client",
          "Commande",
          "Sous-total",
          "Taxes",
          "Total",
        ],
        rows: rows.map((r) => [
          r.number,
          INVOICE_STATUS_LABELS[
            r.status as keyof typeof INVOICE_STATUS_LABELS
          ] ?? r.status,
          r.issue_date,
          r.due_date,
          nameOf(r.customers as Label),
          (Array.isArray(r.orders)
            ? r.orders[0]?.code
            : (r.orders as { code: string } | null)?.code) ?? null,
          amount(r.subtotal),
          amount(r.tax_total),
          amount(r.total),
        ]),
        truncated,
      };
    }
  }
}
