import type { FiscalProfile } from "@/features/invoices/schemas";
import type { PdfDocumentModel } from "@/lib/pdf/render";
import { sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatPhone } from "@/lib/phone";

/** Lignes communes à toutes les pièces (montants en chaînes décimales). */
export type PdfLine = {
  name: string;
  unit: string | null;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
  lineNet: string;
  lineTax: string;
};

export type PdfSeller = {
  name: string;
  city: string | null;
  phone: string | null;
  fiscal: FiscalProfile;
};

export type PdfParty = {
  name: string;
  phone: string | null;
  email?: string | null;
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** « 2026-11-02 » → « 2 novembre 2026 ». */
export function pdfDate(value: string): string {
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

const quantity = (value: string) => value.replace(".", ",");

function itemRows(lines: PdfLine[]): NonNullable<PdfDocumentModel["items"]> {
  return lines.map((line) => {
    const parts = [
      `${quantity(line.quantity)}${line.unit ? ` ${line.unit}` : ""} × ${formatXaf(line.unitPrice)}`,
    ];
    if (Number(line.discount) > 0)
      parts.push(`remise ${formatXaf(line.discount)}`);
    if (Number(line.taxRate) > 0)
      parts.push(`taxe ${quantity(line.taxRate)} %`);
    return {
      name: line.name,
      detail: parts.join(" · "),
      amount: formatXaf(sumAmounts([line.lineNet, line.lineTax])),
    };
  });
}

function totals(subtotal: string, taxTotal: string, total: string) {
  const rows: PdfDocumentModel["totals"] = [];
  if (Number(taxTotal) > 0) {
    rows.push({ label: "Total hors taxes", value: formatXaf(subtotal) });
    rows.push({ label: "Taxes", value: formatXaf(taxTotal) });
  }
  rows.push({ label: "Total", value: formatXaf(total), strong: true });
  return rows;
}

/** Bloc vendeur : nom commercial, raison sociale et identifiants saisis. */
function sellerBlock(seller: PdfSeller, withFiscal: boolean) {
  const lines: string[] = [];
  const fiscal = seller.fiscal;
  if (withFiscal && fiscal.legal_name && fiscal.legal_name !== seller.name)
    lines.push(fiscal.legal_name);
  const address = (withFiscal && fiscal.address) || seller.city;
  if (address) lines.push(address);
  const phone = (withFiscal && fiscal.phone) || seller.phone;
  if (phone)
    lines.push(`Tél. ${phone.startsWith("+") ? formatPhone(phone) : phone}`);
  if (withFiscal && fiscal.email) lines.push(fiscal.email);
  if (withFiscal) {
    if (fiscal.niu) lines.push(`NIU : ${fiscal.niu}`);
    if (fiscal.rccm) lines.push(`RCCM : ${fiscal.rccm}`);
    if (fiscal.tax_regime) lines.push(`Régime : ${fiscal.tax_regime}`);
  }
  return { name: seller.name, lines };
}

function buyerBlock(label: string, party: PdfParty) {
  const lines: string[] = [];
  if (party.phone) lines.push(`Tél. ${formatPhone(party.phone)}`);
  if (party.email) lines.push(party.email);
  return { label, name: party.name, lines };
}

export function quotePdfModel(input: {
  code: string;
  createdOn: string;
  validUntil: string | null;
  status: string;
  seller: PdfSeller;
  customer: PdfParty;
  items: PdfLine[];
  subtotal: string;
  taxTotal: string;
  total: string;
  conditions: string | null;
}): PdfDocumentModel {
  const meta = [{ label: "Date", value: pdfDate(input.createdOn) }];
  if (input.validUntil)
    meta.push({ label: "Valable jusqu'au", value: pdfDate(input.validUntil) });
  return {
    title: "DEVIS",
    reference: input.code,
    watermark: input.status === "draft" ? "BROUILLON" : undefined,
    seller: sellerBlock(input.seller, false),
    buyer: buyerBlock("Client", input.customer),
    meta,
    items: itemRows(input.items),
    totals: totals(input.subtotal, input.taxTotal, input.total),
    sections: input.conditions
      ? [{ title: "Conditions", text: input.conditions }]
      : [],
    notices: [
      "Ce devis est une proposition de prix : ce n'est pas une facture et il n'a pas de valeur fiscale.",
      "Montants en francs CFA (XAF).",
    ],
    author: input.seller.name,
  };
}

export function invoicePdfModel(input: {
  status: "draft" | "issued";
  number: string | null;
  issueDate: string | null;
  dueDate: string | null;
  orderCode: string | null;
  seller: PdfSeller;
  customer: PdfParty;
  items: PdfLine[];
  subtotal: string;
  taxTotal: string;
  total: string;
  conditions: string | null;
}): PdfDocumentModel {
  const draft = input.status === "draft";
  const meta: PdfDocumentModel["meta"] = [];
  if (input.issueDate)
    meta.push({ label: "Date d'émission", value: pdfDate(input.issueDate) });
  if (input.dueDate)
    meta.push({ label: "Échéance", value: pdfDate(input.dueDate) });
  if (input.orderCode) meta.push({ label: "Commande", value: input.orderCode });

  const notices = draft
    ? [
        "BROUILLON — document de travail non émis. Il ne constitue pas une facture, n'a pas de numéro définitif et n'a aucune valeur fiscale.",
      ]
    : [
        "Facture émise : numéro chronologique attribué à l'émission. Toute correction se fait par avoir.",
        "Les identifiants fiscaux du vendeur sont ceux qu'il a déclarés ; Céleste Biz ne les vérifie pas.",
      ];
  if (!draft && input.seller.fiscal.invoice_mentions)
    notices.unshift(input.seller.fiscal.invoice_mentions);
  notices.push("Montants en francs CFA (XAF).");

  return {
    title: draft ? "BROUILLON DE FACTURE" : "FACTURE",
    reference: input.number ?? undefined,
    watermark: draft ? "BROUILLON — NON VALABLE COMME FACTURE" : undefined,
    seller: sellerBlock(input.seller, true),
    buyer: buyerBlock("Facturé à", input.customer),
    meta,
    items: itemRows(input.items),
    totals: totals(input.subtotal, input.taxTotal, input.total),
    sections: input.conditions
      ? [{ title: "Conditions de paiement", text: input.conditions }]
      : [],
    notices,
    author: input.seller.name,
  };
}

export function creditNotePdfModel(input: {
  number: string;
  issueDate: string;
  invoiceNumber: string;
  reason: string;
  amount: string;
  seller: PdfSeller;
  customer: PdfParty;
}): PdfDocumentModel {
  return {
    title: "AVOIR",
    reference: input.number,
    seller: sellerBlock(input.seller, true),
    buyer: buyerBlock("Client", input.customer),
    meta: [
      { label: "Date d'émission", value: pdfDate(input.issueDate) },
      { label: "Facture d'origine", value: input.invoiceNumber },
    ],
    items: [
      { name: "Avoir", detail: input.reason, amount: formatXaf(input.amount) },
    ],
    totals: [
      {
        label: "Montant de l'avoir",
        value: formatXaf(input.amount),
        strong: true,
      },
    ],
    notices: [
      `Cet avoir corrige la facture ${input.invoiceNumber}, qui reste inchangée.`,
      "Montants en francs CFA (XAF).",
    ],
    author: input.seller.name,
  };
}

export function receiptPdfModel(input: {
  orderCode: string;
  paidOn: string;
  method: string;
  reference: string | null;
  amount: string;
  cancelled: boolean;
  orderTotal: string;
  balance: string;
  seller: PdfSeller;
  customer: PdfParty;
}): PdfDocumentModel {
  const meta = [
    { label: "Date", value: pdfDate(input.paidOn) },
    { label: "Commande", value: input.orderCode },
    { label: "Moyen déclaré", value: input.method },
  ];
  if (input.reference)
    meta.push({ label: "Référence", value: input.reference });
  return {
    title: "REÇU D'ENCAISSEMENT",
    watermark: input.cancelled ? "ENCAISSEMENT ANNULÉ" : undefined,
    seller: sellerBlock(input.seller, false),
    buyer: buyerBlock("Reçu de", input.customer),
    meta,
    totals: [
      { label: "Montant reçu", value: formatXaf(input.amount), strong: true },
      { label: "Total de la commande", value: formatXaf(input.orderTotal) },
      { label: "Reste à payer à ce jour", value: formatXaf(input.balance) },
    ],
    notices: [
      "Encaissement déclaré par le commerçant, non vérifié auprès de l'opérateur de paiement.",
      "Ce reçu n'est pas une facture et n'a pas de valeur fiscale.",
      "Montants en francs CFA (XAF).",
    ],
    author: input.seller.name,
  };
}
