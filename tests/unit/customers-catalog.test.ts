import { describe, expect, it } from "vitest";

import { formatCatalogPrice } from "@/features/catalog/format";
import { catalogItemSchema, detectImageType } from "@/features/catalog/schemas";
import { customerSchema } from "@/features/customers/schemas";
import { decodeCursor, encodeCursor } from "@/lib/pagination";

const ID = "4f1c2a3b-5d6e-4f70-8a9b-0c1d2e3f4a5b";
const NBSP = " ";

describe("customerSchema", () => {
  it("normalise le téléphone et l'e-mail, vide → null", () => {
    const result = customerSchema.parse({
      id: ID,
      name: "  Mireille Ngo ",
      phone: "6 77 00 01 01",
      email: " Mireille@Example.CM ",
      notes: "",
    });
    expect(result).toMatchObject({
      name: "Mireille Ngo",
      phone: "+237677000101",
      email: "mireille@example.cm",
      notes: null,
      marketingConsent: false,
      confirmDuplicate: false,
    });
  });

  it("accepte un client sans téléphone ni e-mail", () => {
    const result = customerSchema.parse({ id: ID, name: "Client de passage" });
    expect(result.phone).toBeNull();
    expect(result.email).toBeNull();
  });

  it("refuse un nom vide, un numéro ou un e-mail invalide", () => {
    const result = customerSchema.safeParse({
      id: ID,
      name: "  ",
      phone: "12",
      email: "pas-un-email",
    });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((issue) => issue.path[0]);
    expect(paths).toEqual(expect.arrayContaining(["name", "phone", "email"]));
  });

  it("enregistre le consentement seulement si la case est cochée", () => {
    expect(
      customerSchema.parse({ id: ID, name: "A", marketingConsent: "on" })
        .marketingConsent,
    ).toBe(true);
  });

  it("refuse un identifiant qui n'est pas un UUID", () => {
    expect(customerSchema.safeParse({ id: "1", name: "A" }).success).toBe(
      false,
    );
  });
});

describe("catalogItemSchema", () => {
  const base = { id: ID, kind: "service", name: "Robe sur mesure" };

  it("convertit le prix en montant décimal exact", () => {
    const result = catalogItemSchema.parse({
      ...base,
      priceMode: "fixed",
      price: "25 000",
    });
    expect(result.price).toBe("25000.00");
    expect(result.visible).toBe(false);
    expect(result.position).toBe(0);
  });

  it("ignore le prix pour « sur devis »", () => {
    const result = catalogItemSchema.parse({
      ...base,
      priceMode: "quote",
      price: "999",
    });
    expect(result.price).toBeNull();
  });

  it.each([[""], ["abc"], ["-500"], [undefined]])(
    "exige un prix valide hors devis (%s)",
    (price) => {
      const result = catalogItemSchema.safeParse({
        ...base,
        priceMode: "from",
        price,
      });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].path).toEqual(["price"]);
    },
  );

  it("refuse un type ou un mode de prix inconnu", () => {
    expect(
      catalogItemSchema.safeParse({
        ...base,
        kind: "x",
        priceMode: "fixed",
        price: "1",
      }).success,
    ).toBe(false);
    expect(
      catalogItemSchema.safeParse({ ...base, priceMode: "gratuit" }).success,
    ).toBe(false);
  });

  it("vide les champs facultatifs et lit la visibilité", () => {
    const result = catalogItemSchema.parse({
      ...base,
      priceMode: "quote",
      category: " ",
      unit: "",
      description: "",
      visible: "on",
      position: "3",
    });
    expect(result).toMatchObject({
      category: null,
      unit: null,
      description: null,
      visible: true,
      position: 3,
    });
  });
});

describe("formatCatalogPrice", () => {
  it.each([
    ["fixed", "2500.00", null, `2${NBSP}500\u00a0FCFA`],
    ["from", "25000", null, `À partir de 25${NBSP}000\u00a0FCFA`],
    ["fixed", "1500", "part", `1${NBSP}500\u00a0FCFA / part`],
    ["quote", null, null, "Sur devis"],
  ] as const)("%s %s %s → %s", (mode, price, unit, expected) => {
    expect(formatCatalogPrice(mode, price, unit)).toBe(expected);
  });
});

describe("detectImageType", () => {
  const bytes = (...values: number[]) =>
    new Uint8Array([...values, ...Array(16).fill(0)]);
  const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

  it("reconnaît JPEG, PNG et WebP par leur signature", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("jpg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a))).toBe(
      "png",
    );
    expect(
      detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"))),
    ).toBe("webp");
  });

  it("refuse les autres contenus, même renommés", () => {
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes(...ascii("<svg")))).toBeNull();
    expect(detectImageType(bytes(...ascii("%PDF-")))).toBeNull();
    expect(detectImageType(new Uint8Array())).toBeNull();
  });
});

describe("curseur de pagination", () => {
  it("fait l'aller-retour", () => {
    const cursor = encodeCursor({ name: "mireille ngo", id: ID });
    expect(decodeCursor(cursor, ["name", "id"])).toEqual({
      name: "mireille ngo",
      id: ID,
    });
  });

  it("rejette un curseur altéré ou incomplet", () => {
    expect(decodeCursor("%%%", ["name"])).toBeNull();
    expect(
      decodeCursor(encodeCursor({ name: "a" }), ["name", "id"]),
    ).toBeNull();
    expect(decodeCursor("a".repeat(600), ["name"])).toBeNull();
    expect(decodeCursor(undefined, ["name"])).toBeNull();
  });
});
