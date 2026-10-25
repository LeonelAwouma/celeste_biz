import { describe, expect, it } from "vitest";

import { BUSINESS_ROLES, can, isBusinessRole } from "@/lib/permissions/roles";

describe("matrice des droits", () => {
  it("un staff ne peut ni fermer l'entreprise ni gérer l'abonnement", () => {
    expect(can("staff", "business.close")).toBe(false);
    expect(can("staff", "subscription.manage")).toBe(false);
    expect(can("staff", "members.manage")).toBe(false);
  });

  it("un staff peut enregistrer des commandes et des clients", () => {
    expect(can("staff", "orders.write")).toBe(true);
    expect(can("staff", "customers.write")).toBe(true);
  });

  it("un lecteur ne modifie rien", () => {
    const writes = [
      "business.update",
      "members.manage",
      "catalog.write",
      "customers.write",
      "orders.write",
    ] as const;
    for (const permission of writes) {
      expect(can("viewer", permission), permission).toBe(false);
    }
    expect(can("viewer", "business.read")).toBe(true);
  });

  it("seul le propriétaire administre l'entreprise", () => {
    for (const role of BUSINESS_ROLES) {
      expect(can(role, "members.manage")).toBe(role === "owner");
      expect(can(role, "business.update")).toBe(role === "owner");
    }
  });

  it("valide les rôles inconnus", () => {
    expect(isBusinessRole("manager")).toBe(true);
    expect(isBusinessRole("platform_admin")).toBe(false);
    expect(isBusinessRole(null)).toBe(false);
  });
});
