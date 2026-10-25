import { describe, expect, it } from "vitest";

import {
  MOBILE_TAB_NAV,
  MORE_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isActive,
} from "@/components/dashboard/navigation";

describe("navigation de l'espace commerçant", () => {
  it("suit la navigation recommandée du cahier des charges", () => {
    expect(PRIMARY_NAV.map((item) => item.label)).toEqual([
      "Aujourd'hui",
      "Commandes",
      "Clients",
      "Factures",
      "Catalogue",
      "Mon site",
      "Paramètres",
    ]);
  });

  it("signale le site web comme facultatif", () => {
    const site = PRIMARY_NAV.find((item) => item.label === "Mon site");
    expect(site?.hint).toBe("facultatif");
  });

  it("garde 5 onglets au plus sur mobile", () => {
    expect(MOBILE_TAB_NAV.length).toBeLessThanOrEqual(5);
  });

  it("rend chaque espace accessible sur mobile (onglets ou « Plus »)", () => {
    const mobile = new Set(
      [...MOBILE_TAB_NAV, ...MORE_NAV].map((item) => item.href),
    );
    for (const item of [...PRIMARY_NAV, ...SECONDARY_NAV]) {
      expect(mobile.has(item.href), item.href).toBe(true);
    }
  });

  it("marque l'onglet actif, y compris sur les sous-pages", () => {
    expect(isActive("/dashboard/orders", "/dashboard/orders")).toBe(true);
    expect(isActive("/dashboard/orders/new", "/dashboard/orders")).toBe(true);
    expect(isActive("/dashboard/ordersx", "/dashboard/orders")).toBe(false);
    expect(isActive("/dashboard/today", "/dashboard/orders")).toBe(false);
  });

  it("active « Plus » pour les espaces qu'il regroupe", () => {
    expect(isActive("/dashboard/settings", "/dashboard/more")).toBe(true);
    expect(isActive("/dashboard/quotes", "/dashboard/more")).toBe(true);
    expect(isActive("/dashboard/orders", "/dashboard/more")).toBe(false);
  });
});
