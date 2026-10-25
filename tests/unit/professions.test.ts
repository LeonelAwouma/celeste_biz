import { describe, expect, it } from "vitest";

import {
  resolveModules,
  sanitizeModuleOverrides,
} from "@/features/professions/modules";
import {
  buildOrderDetailsSchema,
  publicOrderDetails,
} from "@/features/professions/order-details";
import {
  PROFESSION_KEYS,
  PROFESSION_TEMPLATES,
  getProfessionTemplate,
} from "@/features/professions/registry";

const couture = getProfessionTemplate("couture");
const catering = getProfessionTemplate("catering");
const generic = getProfessionTemplate("generic");

describe("registre des profils métiers", () => {
  it("contient couture, traiteur et générique en version 1", () => {
    expect(PROFESSION_TEMPLATES.map((t) => `${t.key}@${t.version}`)).toEqual([
      "couture@1",
      "catering@1",
      "generic@1",
    ]);
    for (const key of PROFESSION_KEYS)
      expect(getProfessionTemplate(key).key).toBe(key);
  });

  it("retombe sur le profil générique pour une clé inconnue", () => {
    expect(getProfessionTemplate("astronaute").key).toBe("generic");
  });

  it("n'a jamais deux versions identiques d'un même métier", () => {
    const ids = PROFESSION_TEMPLATES.map((t) => `${t.key}@${t.version}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("propose les modules propres à chaque métier", () => {
    expect(couture.availableModules).toContain("measurements");
    expect(couture.availableModules).not.toContain("events");
    expect(catering.availableModules).toContain("events");
    expect(catering.availableModules).not.toContain("measurements");
    expect(generic.availableModules).toEqual(["quotes", "website"]);
  });

  it("garde le site web facultatif et désactivable partout", () => {
    for (const template of PROFESSION_TEMPLATES) {
      expect(template.availableModules).toContain("website");
    }
  });
});

describe("modules actifs", () => {
  it("active les modules cœur et les modules par défaut du métier", () => {
    const modules = resolveModules(couture);
    for (const core of [
      "orders",
      "customers",
      "catalog",
      "payments",
      "invoices",
    ] as const) {
      expect(modules.has(core)).toBe(true);
    }
    expect(modules.has("measurements")).toBe(true);
    expect(modules.has("events")).toBe(false);
  });

  it("applique les réglages de l'entreprise", () => {
    const modules = resolveModules(couture, { website: false, quotes: false });
    expect(modules.has("website")).toBe(false);
    expect(modules.has("quotes")).toBe(false);
    expect(modules.has("orders")).toBe(true);
  });

  it("n'active jamais un module non proposé par le métier", () => {
    expect(resolveModules(couture, { events: true }).has("events")).toBe(false);
  });

  it("ignore les réglages invalides", () => {
    expect(
      sanitizeModuleOverrides({ website: false, orders: false, quotes: "oui" }),
    ).toEqual({ website: false });
    expect(sanitizeModuleOverrides(null)).toEqual({});
  });
});

describe("informations métier d'une commande (validation serveur)", () => {
  const coutureSchema = buildOrderDetailsSchema(couture);
  const cateringSchema = buildOrderDetailsSchema(catering);

  it("exige les champs obligatoires du métier", () => {
    const missing = coutureSchema.safeParse({});
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.message).toBe(
      "« Type de vêtement » est obligatoire.",
    );
    expect(coutureSchema.safeParse({ garment_type: "  " }).success).toBe(false);
    expect(coutureSchema.safeParse({ garment_type: "robe" }).success).toBe(
      true,
    );
    expect(
      cateringSchema.safeParse({ delivery_mode: "livraison" }).success,
    ).toBe(false);
  });

  it("refuse les champs d'un autre métier ou inconnus", () => {
    const result = coutureSchema.safeParse({
      garment_type: "robe",
      portions: 50,
    });
    expect(result.success).toBe(false);
  });

  it("refuse un choix hors liste et une date impossible", () => {
    expect(coutureSchema.safeParse({ garment_type: "fusee" }).success).toBe(
      false,
    );
    expect(
      coutureSchema.safeParse({
        garment_type: "robe",
        fitting_date: "2026-02-30",
      }).success,
    ).toBe(false);
  });

  it("convertit les nombres et ignore les champs vides", () => {
    const parsed = cateringSchema.parse({
      event_date: "2026-12-24T18:30",
      delivery_mode: "livraison",
      portions: "120",
      event_location: "",
    });
    expect(parsed).toEqual({
      event_date: "2026-12-24T18:30",
      delivery_mode: "livraison",
      portions: 120,
    });
  });

  it("refuse un nombre de portions non entier ou négatif", () => {
    const base = { event_date: "2026-12-24T18:30", delivery_mode: "retrait" };
    expect(
      cateringSchema.safeParse({ ...base, portions: "12.5" }).success,
    ).toBe(false);
    expect(cateringSchema.safeParse({ ...base, portions: "-3" }).success).toBe(
      false,
    );
  });

  it("valide les mesures (cm) et omet les mesures vides", () => {
    const parsed = coutureSchema.parse({
      garment_type: "robe",
      measurements: { tour_taille: "72", tour_hanches: "" },
    });
    expect(parsed.measurements).toEqual({ tour_taille: 72 });
    expect(
      coutureSchema.safeParse({
        garment_type: "robe",
        measurements: { tour_taille: "900" },
      }).success,
    ).toBe(false);
  });

  it("ne montre jamais les champs privés au client final", () => {
    const details = coutureSchema.parse({
      garment_type: "robe",
      measurements: { tour_taille: "72" },
      style_notes: "Col claudine",
    });
    expect(publicOrderDetails(couture, details)).toEqual({
      garment_type: "robe",
      style_notes: "Col claudine",
    });
  });
});
