import { describe, expect, it } from "vitest";

import {
  campaignCreateSchema,
  campaignMessage,
  isPreviewBot,
  suggestCampaignCode,
} from "@/features/campaigns/schemas";
import { whatsappLink } from "@/lib/whatsapp";

describe("codes de campagne", () => {
  it("propose un code lisible à partir du nom", () => {
    expect(suggestCampaignCode("Robes été 2026 !")).toBe("ROBES-ETE-2026");
    expect(suggestCampaignCode("  Fête des mères — wax  ")).toBe(
      "FETE-DES-MERES-WAX",
    );
    expect(suggestCampaignCode("Une campagne au nom vraiment très long")).toBe(
      "UNE-CAMPAGNE-AU-NOM-VRAI",
    );
    // Coupé à 24 caractères, sans tiret final.
    expect(suggestCampaignCode("ABCDEFGHIJKLMNOPQRSTUVW XYZ")).toBe(
      "ABCDEFGHIJKLMNOPQRSTUVW",
    );
  });

  it("valide le code et le message", () => {
    const base = {
      label: "Noël",
      code: "noel-2026",
      source: "facebook",
      catalogItemId: "",
      message: "Bonjour",
    };
    const parsed = campaignCreateSchema.parse(base);
    expect(parsed.code).toBe("NOEL-2026");
    expect(parsed.catalogItemId).toBeNull();
    expect(
      campaignCreateSchema.safeParse({ ...base, code: "A B" }).success,
    ).toBe(false);
    expect(
      campaignCreateSchema.safeParse({ ...base, code: "AB" }).success,
    ).toBe(false);
    expect(
      campaignCreateSchema.safeParse({ ...base, message: " " }).success,
    ).toBe(false);
    expect(
      campaignCreateSchema.safeParse({ ...base, source: "radio" }).success,
    ).toBe(false);
  });
});

describe("message WhatsApp", () => {
  it("ajoute la référence et encode le texte", () => {
    const text = campaignMessage("Bonjour, une robe ?", "ROBE-WAX");
    expect(text).toBe("Bonjour, une robe ?\n\nRéf. ROBE-WAX");
    expect(whatsappLink("+237 690 00 00 01", text)).toBe(
      "https://wa.me/237690000001?text=Bonjour%2C%20une%20robe%20%3F%0A%0AR%C3%A9f.%20ROBE-WAX",
    );
  });

  it("sans numéro : WhatsApp laisse choisir le destinataire", () => {
    expect(whatsappLink(null, "Offre")).toBe("https://wa.me/?text=Offre");
  });
});

describe("robots d'aperçu", () => {
  it("n'est pas compté : aperçus WhatsApp, Facebook, agent absent", () => {
    expect(isPreviewBot("WhatsApp/2.24.1 A")).toBe(true);
    expect(isPreviewBot("facebookexternalhit/1.1")).toBe(true);
    expect(isPreviewBot("TelegramBot (like TwitterBot)")).toBe(true);
    expect(isPreviewBot(null)).toBe(true);
  });

  it("navigateur mobile : compté", () => {
    expect(
      isPreviewBot(
        "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });
});
