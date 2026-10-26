import { describe, expect, it } from "vitest";

import { auditActionLabel, auditDetails } from "@/features/audit/labels";
import { amount, csvCell, toCsv } from "@/lib/csv";
import { redact, redactPath } from "@/lib/observability/redact";

describe("CSV", () => {
  it("BOM UTF-8, séparateur « ; », CRLF, guillemets doublés", () => {
    const csv = toCsv(["Nom", "Note"], [['Café "Chez Ali"', "a;b"]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toBe('﻿"Nom";"Note"\r\n"Café ""Chez Ali""";"a;b"\r\n');
  });

  it("neutralise les formules dans les cellules de texte", () => {
    for (const evil of [
      '=HYPERLINK("x")',
      "+1+1",
      "-2+3",
      "@SUM(A1)",
      "\tcmd",
      "\rcmd",
    ]) {
      expect(csvCell(evil)).toBe(`"'${evil.replace(/"/g, '""')}"`);
    }
    expect(csvCell("Robe = 2 pièces")).toBe('"Robe = 2 pièces"');
  });

  it("montants : virgule décimale, négatifs sans préfixe", () => {
    expect(csvCell(amount("25000.00"))).toBe('"25000,00"');
    expect(csvCell(amount(-1500))).toBe('"-1500,00"');
    expect(csvCell(amount(null))).toBe('""');
    expect(csvCell(amount("=1+1"))).toBe('""');
  });

  it("booléens et vides", () => {
    expect(csvCell(true)).toBe('"oui"');
    expect(csvCell(false)).toBe('"non"');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
  });
});

describe("masquage des journaux", () => {
  it("jetons de suivi et d'invitation", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";
    expect(redactPath(`/suivi/${token}/recu/1?x=1`)).toBe(
      "/suivi/[jeton]/recu/1",
    );
    expect(redact(`GET /invitation/${token}`)).toBe("GET /invitation/[jeton]");
    expect(redact("/auth/confirm?token_hash=abc123&type=email")).toBe(
      "/auth/confirm?token_hash=[masqué]&type=email",
    );
  });

  it("clés, JWT, e-mails et téléphones", () => {
    expect(redact("clé sb_secret_abcdefghijklmnop")).toBe("clé [clé]");
    expect(redact("Bearer eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl")).toBe(
      "Bearer [jwt]",
    );
    expect(redact("contact alice@exemple.test")).toBe("contact [e-mail]");
    expect(redact("tél +237 690 00 00 01")).toBe("tél [tél. …01]");
  });

  it("laisse intacts les montants courts et les identifiants de commande", () => {
    expect(redact("CMD-2026-0001 total 25000")).toBe(
      "CMD-2026-0001 total 25000",
    );
  });
});

describe("journal", () => {
  it("libellés lisibles avec repli", () => {
    expect(auditActionLabel("invoice.issued")).toBe("Facture : émis");
    expect(auditActionLabel("customer.archived")).toBe("Client : archivé");
    expect(auditActionLabel("website.published")).toBe("Site : publié");
    expect(auditActionLabel("inconnu.truc")).toBe("inconnu.truc");
  });

  it("détails sans jeton ni contenu", () => {
    expect(auditDetails({ rows: 12, from: "2026-10-01" })).toBe("12 lignes");
    expect(auditDetails({ link: "uuid", days: 30 })).toBeNull();
    expect(auditDetails({ changed: ["name", "phone_e164"] })).toBe(
      "champs : name, phone_e164",
    );
  });
});
