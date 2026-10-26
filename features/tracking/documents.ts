import "server-only";

import {
  invoicePdfModel,
  receiptPdfModel,
  type PdfLine,
} from "@/features/documents/pdf-models";
import {
  partyFromSnapshot,
  sellerFromSnapshot,
} from "@/features/documents/snapshots";
import { readFiscalProfile } from "@/features/invoices/schemas";
import { toAmount } from "@/features/orders/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/orders/status";
import { quantityText } from "@/features/quotes/queries";
import type { PdfDocumentModel } from "@/lib/pdf/render";

type Raw = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) =>
  typeof value === "number" || typeof value === "string" ? value : 0;
const obj = (value: unknown): Raw | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : null;

/**
 * Reçu partagé via le lien de suivi. Mêmes mentions que côté commerçant
 * (encaissement déclaré, sans valeur fiscale).
 */
export function trackingReceiptModel(data: Raw): {
  model: PdfDocumentModel;
  filename: string;
} {
  const seller = obj(data.seller);
  const customer = obj(data.customer);
  const orderCode = str(data.order_code) ?? "";
  const paidOn = str(data.paid_on) ?? "";
  const method = str(data.method) ?? "";
  return {
    model: receiptPdfModel({
      orderCode,
      paidOn,
      method:
        PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ??
        method,
      reference: str(data.reference),
      amount: toAmount(num(data.amount)),
      cancelled: false,
      orderTotal: toAmount(num(data.order_total)),
      balance: toAmount(num(data.balance)),
      seller: {
        name: str(seller?.name) ?? "",
        city: str(seller?.city),
        phone: str(seller?.phone),
        fiscal: readFiscalProfile({}),
      },
      customer: {
        name: str(customer?.name) ?? "",
        phone: str(customer?.phone),
      },
    }),
    filename: `recu-${orderCode}-${paidOn}.pdf`,
  };
}

/** Facture émise, rendue depuis ses instantanés figés à l'émission. */
export function trackingInvoiceModel(data: Raw): {
  model: PdfDocumentModel;
  filename: string;
} {
  const number = str(data.number) ?? "";
  const items: PdfLine[] = (Array.isArray(data.items) ? data.items : [])
    .map(obj)
    .filter((item): item is Raw => item !== null)
    .map((item) => ({
      name: str(item.name) ?? "",
      unit: str(item.unit),
      quantity: quantityText(num(item.quantity)),
      unitPrice: toAmount(num(item.unit_price)),
      discount: toAmount(num(item.discount)),
      taxRate: quantityText(num(item.tax_rate)),
      lineNet: toAmount(num(item.line_net)),
      lineTax: toAmount(num(item.line_tax)),
    }));
  return {
    model: invoicePdfModel({
      status: "issued",
      number,
      issueDate: str(data.issue_date),
      dueDate: str(data.due_date),
      orderCode: str(data.order_code),
      seller: sellerFromSnapshot(obj(data.seller)),
      customer: partyFromSnapshot(obj(data.buyer), { name: "", phone: null }),
      items,
      subtotal: toAmount(num(data.subtotal)),
      taxTotal: toAmount(num(data.tax_total)),
      total: toAmount(num(data.total)),
      conditions: str(data.conditions),
    }),
    filename: `${number}.pdf`,
  };
}
