import { describe, expect, it } from "vitest";

import {
  itemsToRpc,
  orderFormSchema,
  orderItemSchema,
  parseItemsJson,
  readOrderDetails,
} from "@/features/orders/schemas";
import {
  ORDER_TRANSITIONS,
  availableTransitions,
  isLate,
  itemsEditable,
} from "@/features/orders/status";
import { getProfessionTemplate } from "@/features/professions/registry";
import {
  compareAmounts,
  computeLine,
  parseDecimal,
  subtractAmounts,
  sumAmounts,
} from "@/lib/monetary/decimal";
import { isoToLocalParts, localDateTimeToIso, todayLocal } from "@/lib/time";

const ID = "4f1c2a3b-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const ID2 = "5f1c2a3b-5d6e-4f70-8a9b-0c1d2e3f4a5b";

describe("arithmétique décimale (aperçu identique au calcul SQL)", () => {
  it("reproduit l'exemple vérifié en base", () => {
    const a = computeLine("3", "2500");
    const b = computeLine("1.5", "3333.33", "0.01", "19.25");
    expect(a).toEqual({ net: "7500.00", tax: "0.00", total: "7500.00" });
    expect(b).toEqual({ net: "4999.99", tax: "962.50", total: "5962.49" });
    expect(sumAmounts([a.total, b.total])).toBe("13462.49");
  });

  it("arrondit au centime, moitié loin de zéro", () => {
    expect(computeLine("1", "0.005").net).toBe("0.01");
    expect(computeLine("0.333", "1").net).toBe("0.33");
    expect(computeLine("2", "0.125").net).toBe("0.25");
  });

  it("évite les erreurs de virgule flottante", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(subtractAmounts("13462.49", "5000")).toBe("8462.49");
    expect(compareAmounts("10000.00", "9999.99")).toBe(1);
    expect(compareAmounts("5", "5.00")).toBe(0);
  });

  it("lit une quantité décimale française", () => {
    expect(parseDecimal("1,5", 3)).toBe("1.5");
    expect(parseDecimal("2.000", 3)).toBe("2");
    expect(parseDecimal("0,1234", 3)).toBeNull();
    expect(parseDecimal("-1", 3)).toBeNull();
    expect(parseDecimal("abc", 3)).toBeNull();
  });
});

describe("fuseau de l'entreprise (Douala, UTC+1)", () => {
  it("convertit une saisie locale en UTC et inversement", () => {
    expect(localDateTimeToIso("2026-11-02", "14:30")).toBe(
      "2026-11-02T13:30:00.000Z",
    );
    expect(localDateTimeToIso("2026-11-02")).toBe("2026-11-02T17:00:00.000Z");
    expect(isoToLocalParts("2026-11-02T23:30:00.000Z")).toEqual({
      date: "2026-11-03",
      time: "00:30",
    });
  });

  it("refuse les dates impossibles", () => {
    expect(localDateTimeToIso("2026-02-30")).toBeNull();
    expect(localDateTimeToIso("2026-11-02", "25:00")).toBeNull();
    expect(localDateTimeToIso("02/11/2026")).toBeNull();
  });

  it("donne la date du jour locale", () => {
    expect(todayLocal(undefined, Date.parse("2026-12-31T23:30:00Z"))).toBe(
      "2027-01-01",
    );
  });
});

describe("transitions de commande", () => {
  it("n'ouvre l'annulation et le litige qu'au propriétaire et au gestionnaire", () => {
    const staff = availableTransitions("confirmed", "staff").map((t) => t.to);
    const owner = availableTransitions("confirmed", "owner").map((t) => t.to);
    expect(staff).toEqual(["in_progress", "ready"]);
    expect(owner).toEqual(expect.arrayContaining(["cancelled", "disputed"]));
    expect(availableTransitions("confirmed", "viewer")).toEqual([]);
  });

  it("aucune sortie depuis clôturée ou annulée", () => {
    expect(
      ORDER_TRANSITIONS.some(
        ([from]) => from === "closed" || from === "cancelled",
      ),
    ).toBe(false);
  });

  it("distingue avancer et revenir en arrière, avec les libellés du métier", () => {
    const couture = getProfessionTemplate("couture");
    const actions = availableTransitions("ready", "staff", couture);
    expect(actions.find((a) => a.to === "in_progress")).toMatchObject({
      kind: "back",
      label: "Revenir à « En confection »",
    });
    expect(actions.find((a) => a.to === "delivered")?.kind).toBe("forward");
  });

  it("fige les lignes après confirmation et détecte le retard", () => {
    expect(itemsEditable("draft")).toBe(true);
    expect(itemsEditable("confirmed")).toBe(false);
    const now = Date.parse("2026-11-02T12:00:00Z");
    expect(isLate("2026-11-01T12:00:00Z", "in_progress", now)).toBe(true);
    expect(isLate("2026-11-01T12:00:00Z", "delivered", now)).toBe(false);
    expect(isLate(null, "confirmed", now)).toBe(false);
  });
});

describe("lignes de commande", () => {
  it("normalise une ligne saisie", () => {
    const item = orderItemSchema.parse({
      catalogItemId: "",
      name: " Robe ",
      unit: "",
      quantity: "1,5",
      unitPrice: "15 000",
      discount: "",
      taxRate: "19,25 %",
    });
    expect(item).toEqual({
      catalogItemId: null,
      name: "Robe",
      unit: null,
      quantity: "1.5",
      unitPrice: "15000.00",
      discount: "0.00",
      taxRate: "19.25",
    });
    expect(itemsToRpc([item])[0]).toMatchObject({
      unit_price: "15000.00",
      tax_rate: "19.25",
    });
  });

  it("refuse quantité nulle, prix absent, remise trop forte, taxe > 100 %", () => {
    const base = { name: "X", quantity: "1", unitPrice: "100" };
    expect(orderItemSchema.safeParse({ ...base, quantity: "0" }).success).toBe(
      false,
    );
    expect(orderItemSchema.safeParse({ ...base, unitPrice: "" }).success).toBe(
      false,
    );
    expect(
      orderItemSchema.safeParse({ ...base, discount: "150" }).success,
    ).toBe(false);
    expect(orderItemSchema.safeParse({ ...base, taxRate: "120" }).success).toBe(
      false,
    );
  });

  it("exige au moins une ligne et tolère un JSON invalide", () => {
    expect(parseItemsJson("[]").success).toBe(false);
    expect(parseItemsJson("pas du json").success).toBe(false);
    expect(parseItemsJson(null).success).toBe(false);
  });
});

describe("formulaire de commande", () => {
  const base = { id: ID, customerMode: "existing", customerId: ID2 };

  it("calcule l'échéance et l'acompte", () => {
    const result = orderFormSchema.parse({
      ...base,
      dueDate: "2026-11-02",
      dueTime: "10:00",
      depositAmount: "10 000",
      depositMethod: "mobile_money",
      depositId: ID,
    });
    expect(result.dueAt).toBe("2026-11-02T09:00:00.000Z");
    expect(result.deposit).toEqual({
      id: ID,
      amount: "10000.00",
      method: "mobile_money",
      reference: null,
    });
    expect(result.asDraft).toBe(false);
  });

  it("exige un client et une date avec l'heure", () => {
    const noCustomer = orderFormSchema.safeParse({
      id: ID,
      customerMode: "existing",
    });
    expect(noCustomer.error?.issues[0].path).toEqual(["customerId"]);
    const newCustomer = orderFormSchema.safeParse({
      id: ID,
      customerMode: "new",
      newCustomerId: ID2,
    });
    expect(newCustomer.error?.issues[0].path).toEqual(["newCustomerName"]);
    const timeOnly = orderFormSchema.safeParse({ ...base, dueTime: "10:00" });
    expect(timeOnly.error?.issues[0].path).toEqual(["dueDate"]);
  });

  it("refuse un acompte invalide", () => {
    const result = orderFormSchema.safeParse({
      ...base,
      depositAmount: "0",
      depositMethod: "cash",
      depositId: ID,
    });
    expect(result.error?.issues[0].path).toEqual(["depositAmount"]);
  });

  it("reconstitue les informations métier, mesures comprises", () => {
    const couture = getProfessionTemplate("couture");
    const form = new FormData();
    form.set("detail_garment_type", "robe");
    form.set("detail_measurements__tour_taille", "74");
    const details = readOrderDetails(form, couture.orderFields);
    expect(details.garment_type).toBe("robe");
    expect((details.measurements as Record<string, string>).tour_taille).toBe(
      "74",
    );
  });
});
