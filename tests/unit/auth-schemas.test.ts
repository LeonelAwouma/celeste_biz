import { describe, expect, it } from "vitest";

import {
  keepValues,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/features/auth/schemas";
import { createBusinessSchema } from "@/features/businesses/schemas";

describe("schémas d'authentification", () => {
  it("normalise l'adresse e-mail", () => {
    const parsed = signInSchema.parse({
      email: "  Alice@Exemple.TEST ",
      password: "x",
    });
    expect(parsed.email).toBe("alice@exemple.test");
  });

  it("exige lettres et chiffres dans le mot de passe", () => {
    const base = { displayName: "Awa", email: "awa@exemple.test" };
    expect(
      signUpSchema.safeParse({ ...base, password: "abcdefgh" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...base, password: "12345678" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...base, password: "abc1234" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ ...base, password: "abcd1234" }).success,
    ).toBe(true);
  });

  it("vérifie la confirmation du nouveau mot de passe", () => {
    const result = updatePasswordSchema.safeParse({
      password: "Nouveau2026",
      confirmation: "Nouveau2025",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmation"]);
  });

  it("ne conserve jamais le mot de passe dans les valeurs réaffichées", () => {
    const formData = new FormData();
    formData.set("email", "awa@exemple.test");
    formData.set("password", "secret123");
    expect(keepValues(formData, ["email"])).toEqual({
      email: "awa@exemple.test",
    });
  });
});

describe("création d'entreprise", () => {
  it("exige un nom d'au moins 2 caractères", () => {
    expect(
      createBusinessSchema.safeParse({ name: " A ", professionKey: "generic" })
        .success,
    ).toBe(false);
  });

  it("rend la ville et le WhatsApp facultatifs", () => {
    expect(
      createBusinessSchema.parse({
        name: "Atelier",
        professionKey: "couture",
        city: "",
        whatsappPhone: "",
      }),
    ).toEqual({
      name: "Atelier",
      professionKey: "couture",
      city: undefined,
      whatsappPhone: undefined,
    });
  });

  it("exige un métier connu", () => {
    expect(createBusinessSchema.safeParse({ name: "Atelier" }).success).toBe(
      false,
    );
    expect(
      createBusinessSchema.safeParse({
        name: "Atelier",
        professionKey: "pilote",
      }).success,
    ).toBe(false);
  });

  it("normalise le numéro WhatsApp", () => {
    const parsed = createBusinessSchema.parse({
      name: "Atelier",
      professionKey: "couture",
      whatsappPhone: "6 77 12 34 56",
    });
    expect(parsed.whatsappPhone).toBe("+237677123456");
    expect(
      createBusinessSchema.safeParse({
        name: "Atelier",
        professionKey: "couture",
        whatsappPhone: "12",
      }).success,
    ).toBe(false);
  });
});
