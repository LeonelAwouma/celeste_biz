import { describe, expect, it } from "vitest";

import { formatXaf, parseXafAmount, toInputAmount } from "@/lib/monetary/xaf";

describe("parseXafAmount", () => {
  it.each([
    ["15000", "15000.00"],
    ["15 000", "15000.00"],
    ["15 000", "15000.00"],
    ["15.000", "15000.00"],
    ["1.250.000", "1250000.00"],
    ["2500,5", "2500.50"],
    ["2 500,50", "2500.50"],
    ["2500.75", "2500.75"],
    ["25 000 FCFA", "25000.00"],
    ["0", "0.00"],
    ["007", "7.00"],
  ])("lit %j", (input, expected) => {
    expect(parseXafAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "-500", "12,345", "1e5", "15 000,", "12345678901234567"])(
    "refuse %j",
    (input) => {
      expect(parseXafAmount(input)).toBeNull();
    },
  );

  it("n'utilise pas de flottants : grands montants exacts", () => {
    expect(parseXafAmount("9 999 999 999 999 999,99")).toBe(
      "9999999999999999.99",
    );
  });
});

describe("formatXaf", () => {
  it.each([
    ["25000.00", "25 000 FCFA"],
    ["1250000", "1 250 000 FCFA"],
    ["2500.50", "2 500,50 FCFA"],
    ["0", "0 FCFA"],
    ["999", "999 FCFA"],
  ])("formate %j", (input, expected) => {
    expect(formatXaf(input)).toBe(expected);
  });

  it("accepte un nombre renvoyé par l'API", () => {
    expect(formatXaf(15000)).toBe("15 000 FCFA");
  });
});

describe("toInputAmount", () => {
  it("prépare la valeur d'un champ", () => {
    expect(toInputAmount(25000)).toBe("25000");
    expect(toInputAmount("2500.50")).toBe("2500,5");
    expect(toInputAmount(null)).toBe("");
  });
});
