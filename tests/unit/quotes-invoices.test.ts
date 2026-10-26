import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  invoicePdfModel,
  pdfDate,
  quotePdfModel,
  receiptPdfModel,
  type PdfLine,
  type PdfSeller,
} from "@/features/documents/pdf-models";
import {
  partyFromSnapshot,
  sellerFromSnapshot,
} from "@/features/documents/snapshots";
import {
  compactProfile,
  creditNoteSchema,
  fiscalProfileSchema,
  readFiscalProfile,
} from "@/features/invoices/schemas";
import { quoteFormSchema } from "@/features/quotes/schemas";
import {
  availableQuoteActions,
  isQuoteExpired,
} from "@/features/quotes/status";
import { renderPdf, toWinAnsi, wrapText } from "@/lib/pdf/render";
import { formatXaf } from "@/lib/monetary/xaf";
import { addDays } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";

const seller: PdfSeller = {
  name: "Atelier Alice",
  city: "Douala",
  phone: "+237677000001",
  fiscal: { legal_name: "Atelier Mireille SARL", niu: "M000000000000X" },
};
const customer = { name: "Paul Etoga", phone: "+237699000102" };
const line: PdfLine = {
  name: "Robe sur mesure",
  unit: "pièce",
  quantity: "2",
  unitPrice: "35000.00",
  discount: "0.00",
  taxRate: "0",
  lineNet: "70000.00",
  lineTax: "0.00",
};

describe("rendu PDF", () => {
  it("remplace les caractères hors WinAnsi (espaces fines des montants)", () => {
    expect(toWinAnsi("25 000 FCFA")).toBe("25 000 FCFA");
    expect(toWinAnsi("Reçu · « déclaré » – 12 €")).toBe(
      "Reçu · « déclaré » – 12 €",
    );
    expect(toWinAnsi("ligne\nsuivante")).toBe("ligne suivante");
    expect(toWinAnsi("✓ 日本")).toBe("? ??");
  });

  it("découpe le texte selon la largeur disponible", () => {
    const font = { widthOfTextAtSize: (text: string) => text.length };
    expect(wrapText("un deux trois quatre", font, 10, 9)).toEqual([
      "un deux",
      "trois",
      "quatre",
    ]);
    expect(wrapText("abcdefghij", font, 10, 4)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("produit un PDF valide, sur plusieurs pages si nécessaire", async () => {
    const short = await renderPdf(
      quotePdfModel({
        code: "DEV-2026-0001",
        createdOn: "2026-10-26",
        validUntil: "2026-11-10",
        status: "sent",
        seller,
        customer,
        items: [line],
        subtotal: "70000.00",
        taxTotal: "0.00",
        total: "70000.00",
        conditions: "Acompte de 50 %.",
      }),
    );
    expect(Buffer.from(short.subarray(0, 5)).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(short)).getPageCount()).toBe(1);

    const long = await renderPdf(
      quotePdfModel({
        code: "DEV-2026-0002",
        createdOn: "2026-10-26",
        validUntil: null,
        status: "draft",
        seller,
        customer,
        items: Array.from({ length: 40 }, (_, i) => ({
          ...line,
          name: `Article ${i + 1}`,
        })),
        subtotal: "0.00",
        taxTotal: "0.00",
        total: "0.00",
        conditions: null,
      }),
    );
    const document = await PDFDocument.load(long);
    expect(document.getPageCount()).toBeGreaterThan(1);
    expect(document.getTitle()).toBe("DEVIS DEV-2026-0002");
  });
});

describe("modèles de pièces", () => {
  it("date lisible en français", () => {
    expect(pdfDate("2026-11-02")).toBe("2 novembre 2026");
  });

  it("devis : filigrane en brouillon, jamais présenté comme une facture", () => {
    const base = {
      code: "DEV-2026-0001",
      createdOn: "2026-10-26",
      validUntil: "2026-11-10",
      seller,
      customer,
      items: [line],
      subtotal: "70000.00",
      taxTotal: "0.00",
      total: "70000.00",
      conditions: null,
    };
    const draft = quotePdfModel({ ...base, status: "draft" });
    const sent = quotePdfModel({ ...base, status: "sent" });
    expect(draft.watermark).toBe("BROUILLON");
    expect(sent.watermark).toBeUndefined();
    expect(sent.notices.join(" ")).toContain("ce n'est pas une facture");
    expect(sent.meta).toContainEqual({
      label: "Valable jusqu'au",
      value: "10 novembre 2026",
    });
    // Le devis n'imprime pas les identifiants fiscaux.
    expect(sent.seller.lines.join(" ")).not.toContain("NIU");
    expect(sent.items?.[0]).toEqual({
      name: "Robe sur mesure",
      detail: `2 pièce × ${formatXaf("35000")}`,
      amount: formatXaf("70000"),
    });
  });

  it("facture brouillon : sans numéro, filigrane et mention explicite", () => {
    const model = invoicePdfModel({
      status: "draft",
      number: null,
      issueDate: null,
      dueDate: "2026-11-30",
      orderCode: "CMD-2026-0004",
      seller,
      customer,
      items: [line],
      subtotal: "70000.00",
      taxTotal: "0.00",
      total: "70000.00",
      conditions: null,
    });
    expect(model.title).toBe("BROUILLON DE FACTURE");
    expect(model.reference).toBeUndefined();
    expect(model.watermark).toMatch(/NON VALABLE COMME FACTURE/);
    expect(model.notices[0]).toMatch(/aucune valeur fiscale/);
  });

  it("facture émise : numéro, identifiants déclarés, aucune mention de certification", () => {
    const model = invoicePdfModel({
      status: "issued",
      number: "FAC-2026-0001",
      issueDate: "2026-10-26",
      dueDate: null,
      orderCode: null,
      seller: {
        ...seller,
        fiscal: { ...seller.fiscal, invoice_mentions: "Pénalités : 1 %." },
      },
      customer,
      items: [{ ...line, taxRate: "19.25", lineTax: "13475.00" }],
      subtotal: "70000.00",
      taxTotal: "13475.00",
      total: "83475.00",
      conditions: "Payable à réception.",
    });
    expect(model.title).toBe("FACTURE");
    expect(model.reference).toBe("FAC-2026-0001");
    expect(model.watermark).toBeUndefined();
    expect(model.seller.lines).toContain("NIU : M000000000000X");
    expect(model.seller.lines).toContain("Atelier Mireille SARL");
    expect(model.totals.map((t) => t.label)).toEqual([
      "Total hors taxes",
      "Taxes",
      "Total",
    ]);
    expect(model.notices[0]).toBe("Pénalités : 1 %.");
    expect(model.notices.join(" ")).not.toMatch(/certifi/i);
  });

  it("reçu : encaissement déclaré, non vérifié, sans valeur fiscale", () => {
    const model = receiptPdfModel({
      orderCode: "CMD-2026-0001",
      paidOn: "2026-10-21",
      method: "Mobile Money",
      reference: "MP241020",
      amount: "15000.00",
      cancelled: false,
      orderTotal: "35000.00",
      balance: "20000.00",
      seller,
      customer,
    });
    const notices = model.notices.join(" ");
    expect(notices).toContain("non vérifié");
    expect(notices).toContain("n'est pas une facture");
    expect(model.watermark).toBeUndefined();
    expect(
      receiptPdfModel({ ...modelInput(), cancelled: true }).watermark,
    ).toBe("ENCAISSEMENT ANNULÉ");
  });

  it("instantanés figés à l'émission", () => {
    expect(
      sellerFromSnapshot({
        name: "Atelier Alice",
        city: "Douala",
        phone: null,
        fiscal: { legal_name: "SARL", niu: 42 },
      }),
    ).toEqual({
      name: "Atelier Alice",
      city: "Douala",
      phone: null,
      fiscal: {},
    });
    expect(partyFromSnapshot(null, customer)).toBe(customer);
    expect(
      partyFromSnapshot(
        { name: "Paul E.", phone: null, email: null },
        customer,
      ),
    ).toEqual({ name: "Paul E.", phone: null, email: null });
  });
});

function modelInput() {
  return {
    orderCode: "CMD-2026-0001",
    paidOn: "2026-10-21",
    method: "Espèces",
    reference: null,
    amount: "1000.00",
    cancelled: false,
    orderTotal: "1000.00",
    balance: "0.00",
    seller,
    customer,
  };
}

describe("devis", () => {
  it("actions selon le rôle : l'employé n'annule pas, le lecteur ne fait rien", () => {
    expect(availableQuoteActions("draft", "staff").map((a) => a.to)).toEqual([
      "sent",
    ]);
    expect(availableQuoteActions("draft", "owner").map((a) => a.to)).toEqual([
      "sent",
      "cancelled",
    ]);
    expect(availableQuoteActions("sent", "staff").map((a) => a.to)).toEqual([
      "accepted",
      "rejected",
      "draft",
      "expired",
    ]);
    expect(availableQuoteActions("sent", "viewer")).toEqual([]);
    expect(availableQuoteActions("accepted", "owner")).toEqual([]);
    const cancel = availableQuoteActions("sent", "manager").find(
      (a) => a.to === "cancelled",
    );
    expect(cancel?.note).toBe("required");
  });

  it("expiration par date locale", () => {
    expect(isQuoteExpired("2026-10-25", "2026-10-26")).toBe(true);
    expect(isQuoteExpired("2026-10-26", "2026-10-26")).toBe(false);
    expect(isQuoteExpired(null, "2026-10-26")).toBe(false);
  });

  it("formulaire : date de validité facultative et vérifiée", () => {
    const base = {
      id: crypto.randomUUID(),
      customerMode: "existing",
      customerId: crypto.randomUUID(),
    };
    expect(quoteFormSchema.parse({ ...base, validUntil: "" }).validUntil).toBe(
      null,
    );
    expect(
      quoteFormSchema.safeParse({ ...base, validUntil: "10/11/2026" }).success,
    ).toBe(false);
    expect(
      quoteFormSchema.parse({ ...base, conditions: "  Acompte  " }).conditions,
    ).toBe("Acompte");
  });
});

describe("facturation", () => {
  it("profil de facturation : champs vides retirés, e-mail vérifié", () => {
    const parsed = fiscalProfileSchema.parse({
      legal_name: " Atelier Mireille SARL ",
      niu: "",
      email: "",
    });
    expect(compactProfile(parsed)).toEqual({
      legal_name: "Atelier Mireille SARL",
    });
    expect(
      fiscalProfileSchema.safeParse({ email: "pas-un-email" }).success,
    ).toBe(false);
    expect(readFiscalProfile(null)).toEqual({});
  });

  it("avoir : montant positif et motif obligatoire", () => {
    const base = { id: crypto.randomUUID(), invoiceId: crypto.randomUUID() };
    expect(
      creditNoteSchema.parse({ ...base, amount: "5 000", reason: "Remise" })
        .amount,
    ).toBe("5000.00");
    expect(
      creditNoteSchema.safeParse({ ...base, amount: "0", reason: "Remise" })
        .success,
    ).toBe(false);
    expect(
      creditNoteSchema.safeParse({ ...base, amount: "100", reason: " " })
        .success,
    ).toBe(false);
  });
});

describe("utilitaires", () => {
  it("lien WhatsApp wa.me avec message prérempli", () => {
    expect(whatsappLink("+237699000102", "Bonjour & merci")).toBe(
      "https://wa.me/237699000102?text=Bonjour%20%26%20merci",
    );
    expect(whatsappLink(null, "Devis")).toBe("https://wa.me/?text=Devis");
  });

  it("ajout de jours au calendrier", () => {
    expect(addDays("2026-10-26", 15)).toBe("2026-11-10");
    expect(addDays("2026-12-25", 10)).toBe("2027-01-04");
  });
});
