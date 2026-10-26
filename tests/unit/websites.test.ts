import { describe, expect, it } from "vitest";

import {
  buildSiteModel,
  parsePublishedSnapshot,
  servicePriceLabel,
} from "@/features/websites/model";
import {
  readSiteContent,
  readSiteMedia,
  referencedSiteImages,
  siteFormSchema,
} from "@/features/websites/schemas";
import { SITE_ACCENTS, getSiteTemplate } from "@/features/websites/templates";
import { formatXaf } from "@/lib/monetary/xaf";

const BIZ = "aaaaaaaa-0000-4000-8000-000000000001";

const form = {
  version: "3",
  templateKey: "couture",
  slug: "Atelier-Alice",
  headline: "  Couture sur mesure  ",
  about: "",
  hours: "",
  area: "Akwa",
  accent: "emerald",
  showPrices: true,
  serviceIds: [],
};

describe("formulaire du site", () => {
  it("normalise l'adresse et vide les champs facultatifs", () => {
    const parsed = siteFormSchema.parse(form);
    expect(parsed.slug).toBe("atelier-alice");
    expect(parsed.headline).toBe("Couture sur mesure");
    expect(parsed.about).toBeNull();
    expect(parsed.version).toBe(3);
  });

  it("refuse adresses réservées, mal formées ou trop courtes", () => {
    for (const slug of ["admin", "suivi", "mon site", "é-t-é", "ab", "a--b"]) {
      expect(siteFormSchema.safeParse({ ...form, slug }).success).toBe(false);
    }
  });

  it("refuse un modèle ou une couleur inconnus, et plus de 24 prestations", () => {
    expect(
      siteFormSchema.safeParse({ ...form, templateKey: "boutique" }).success,
    ).toBe(false);
    expect(siteFormSchema.safeParse({ ...form, accent: "fluo" }).success).toBe(
      false,
    );
    const ids = Array.from(
      { length: 25 },
      (_, i) => `ca100000-0000-4000-8000-${String(i).padStart(12, "0")}`,
    );
    expect(siteFormSchema.safeParse({ ...form, serviceIds: ids }).success).toBe(
      false,
    );
  });
});

describe("contenu enregistré", () => {
  it("valeurs par défaut sûres", () => {
    expect(readSiteContent(null)).toEqual({
      headline: null,
      about: null,
      hours: null,
      area: null,
      accent: "indigo",
      showPrices: true,
      serviceIds: [],
    });
    expect(readSiteMedia({ gallery: ["a", 3] })).toEqual({
      logo: null,
      banner: null,
      gallery: ["a"],
    });
  });

  it("photos encore utiles : brouillon et version publiée", () => {
    const keep = referencedSiteImages(
      { logo: `${BIZ}/1.webp`, banner: null, gallery: [`${BIZ}/2.webp`] },
      { logo: `${BIZ}/0.webp`, banner: null, gallery: [] },
      null,
    );
    expect([...keep].sort()).toEqual([
      `${BIZ}/0.webp`,
      `${BIZ}/1.webp`,
      `${BIZ}/2.webp`,
    ]);
  });
});

describe("rendu du site", () => {
  const snapshot = parsePublishedSnapshot({
    template_key: "catering",
    business: {
      name: "Délices de Bob",
      city: "Yaoundé",
      whatsapp: "+237690000002",
    },
    content: { headline: "Gâteaux", accent: "terracotta", show_prices: false },
    media: { logo: `${BIZ}/logo.webp`, gallery: [`${BIZ}/g1.webp`] },
    services: [
      {
        name: "Gâteau",
        price_mode: "from",
        price: 15000,
        unit: "gâteau",
        image: `${BIZ}/c.webp`,
      },
      {
        name: "Buffet",
        price_mode: "quote",
        price: null,
        unit: null,
        image: null,
      },
    ],
    version: 2,
    published_at: "2026-10-26T08:00:00+00:00",
  });

  it("prix masqués : « Prix sur demande », sauf « Sur devis »", () => {
    const site = buildSiteModel(
      snapshot!,
      (bucket, path) => `/${bucket}/${path}`,
    );
    expect(site.services.map((s) => s.priceLabel)).toEqual([
      "Prix sur demande",
      "Sur devis",
    ]);
    expect(site.accentColor).toBe(SITE_ACCENTS.terracotta.color);
    expect(site.logoUrl).toBe(`/site/${BIZ}/logo.webp`);
    expect(site.services[0].imageUrl).toBe(`/catalog/${BIZ}/c.webp`);
    expect(site.template.sections[0]).toBe("services");
  });

  it("prix affichés avec le mode « à partir de »", () => {
    expect(
      servicePriceLabel(
        { price_mode: "from", price: 15000, unit: "gâteau" },
        true,
      ),
    ).toBe(`À partir de ${formatXaf(15000)} / gâteau`);
  });

  it("modèle inconnu : modèle générique ; réponse vide : aucun site", () => {
    expect(getSiteTemplate("inconnu").key).toBe("generic");
    expect(parsePublishedSnapshot(null)).toBeNull();
  });

  it("l'ordre des sections dépend du modèle", () => {
    expect(getSiteTemplate("couture").sections[0]).toBe("gallery");
    expect(getSiteTemplate("generic").sections[0]).toBe("about");
  });
});
