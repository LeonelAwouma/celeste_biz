import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  trackingInvoiceModel,
  trackingReceiptModel,
} from "@/features/tracking/documents";
import { isTokenShape, parseTrackingView } from "@/features/tracking/view";
import { renderPdf } from "@/lib/pdf/render";

const valid = {
  state: "valid",
  expires_at: "2026-12-25T10:00:00+00:00",
  business_name: "Atelier Alice",
  business_phone: "+237690000001",
  business_city: "Douala",
  profession_key: "couture",
  profession_version: 1,
  order: {
    code: "CMD-2026-0001",
    status: "in_progress",
    due_at: "2026-10-28T17:00:00+00:00",
    production_step: "assemblage",
    updated_at: "2026-10-26T08:00:00+00:00",
    customer_name: "Mireille Ngo",
  },
  items: [
    { name: "Robe", unit: "pièce", quantity: 10 },
    { name: "Tissu", unit: "m", quantity: "2.500" },
    { name: "Ourlet", unit: null, quantity: "1.000" },
  ],
  amounts: { total: 35000, paid_total: 15000, balance: 20000 },
  history: [{ to_status: "confirmed", at: "2026-10-21T08:00:00+00:00" }],
  documents: {
    receipts: [{ id: "r1", paid_on: "2026-10-21", amount: 15000 }],
    invoices: [],
  },
};

describe("vue de suivi client", () => {
  it("conserve les quantités et convertit les montants", () => {
    const view = parseTrackingView(valid);
    if (view.state !== "valid") throw new Error("état inattendu");
    expect(view.items.map((item) => item.quantity)).toEqual(["10", "2.5", "1"]);
    expect(view.amounts).toEqual({
      total: "35000.00",
      paidTotal: "15000.00",
      balance: "20000.00",
    });
    expect(view.order.customerName).toBe("Mireille Ngo");
    expect(view.documents?.receipts[0]).toEqual({
      id: "r1",
      paidOn: "2026-10-21",
      amount: "15000.00",
    });
  });

  it("montants et pièces masqués restent absents", () => {
    const view = parseTrackingView({
      ...valid,
      amounts: null,
      documents: null,
    });
    expect(view).toMatchObject({ amounts: null, documents: null });
  });

  it("lien révoqué ou expiré : seulement le commerçant à recontacter", () => {
    expect(
      parseTrackingView({
        state: "revoked",
        business_name: "Atelier Alice",
        business_phone: null,
        order: valid.order,
      }),
    ).toEqual({
      state: "revoked",
      businessName: "Atelier Alice",
      businessPhone: null,
    });
  });

  it("toute autre réponse vaut « introuvable »", () => {
    expect(parseTrackingView(null)).toEqual({ state: "not_found" });
    expect(parseTrackingView({ state: "autre" })).toEqual({
      state: "not_found",
    });
  });

  it("forme du jeton : 43 caractères base64url", () => {
    expect(isTokenShape("A".repeat(43))).toBe(true);
    expect(isTokenShape("a-b_".repeat(10) + "xyz")).toBe(true);
    expect(isTokenShape("A".repeat(42))).toBe(false);
    expect(isTokenShape("A".repeat(42) + "/")).toBe(false);
    expect(isTokenShape("jeton-inexistant")).toBe(false);
  });
});

describe("pièces téléchargées depuis le suivi", () => {
  it("reçu : libellé du moyen de paiement et PDF valide", async () => {
    const { model, filename } = trackingReceiptModel({
      order_code: "CMD-2026-0001",
      order_total: 35000,
      balance: 20000,
      paid_on: "2026-10-21",
      method: "mobile_money",
      reference: null,
      amount: 15000,
      seller: { name: "Atelier Alice", city: "Douala", phone: null },
      customer: { name: "Mireille Ngo", phone: null },
    });
    expect(filename).toBe("recu-CMD-2026-0001-2026-10-21.pdf");
    expect(JSON.stringify(model)).toContain("Mobile Money");
    const bytes = await renderPdf(model);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });

  it("facture : rendue depuis les instantanés figés", async () => {
    const { model, filename } = trackingInvoiceModel({
      number: "FAC-2026-0001",
      issue_date: "2026-10-22",
      due_date: null,
      order_code: "CMD-2026-0001",
      conditions: null,
      subtotal: 35000,
      tax_total: 0,
      total: 35000,
      seller: { name: "Atelier Alice (figé)", city: "Douala", phone: null },
      buyer: { name: "Mireille Ngo", phone: null },
      items: [
        {
          name: "Robe",
          unit: "pièce",
          quantity: 1,
          unit_price: 35000,
          discount: 0,
          tax_rate: 0,
          line_net: 35000,
          line_tax: 0,
        },
      ],
    });
    expect(filename).toBe("FAC-2026-0001.pdf");
    const text = JSON.stringify(model);
    expect(text).toContain("Atelier Alice (figé)");
    expect(text).toContain("FAC-2026-0001");
    const bytes = await renderPdf(model);
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
  });
});
