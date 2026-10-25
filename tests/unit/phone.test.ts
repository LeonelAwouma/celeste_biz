import { describe, expect, it } from "vitest";

import { formatPhone, normalizePhoneE164 } from "@/lib/phone";

describe("numéros de téléphone", () => {
  it.each([
    ["677123456", "+237677123456"],
    ["6 77 12 34 56", "+237677123456"],
    ["677-12-34-56", "+237677123456"],
    ["+237 677 12 34 56", "+237677123456"],
    ["00237677123456", "+237677123456"],
    ["237677123456", "+237677123456"],
    ["222 12 34 56", "+237222123456"],
    ["+33 6 12 34 56 78", "+33612345678"],
  ])("normalise %j", (input, expected) => {
    expect(normalizePhoneE164(input)).toBe(expected);
  });

  it.each([
    "",
    "12345",
    "577123456",
    "+237 5771 23456",
    "+2376771234567",
    "abc",
  ])("refuse %j", (input) => {
    expect(normalizePhoneE164(input)).toBeNull();
  });

  it("formate un numéro camerounais", () => {
    expect(formatPhone("+237677123456")).toBe("+237 6 77 12 34 56");
    expect(formatPhone("+33612345678")).toBe("+33612345678");
  });
});
