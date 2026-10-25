import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/security/safe-redirect";

describe("safeRedirectPath", () => {
  it("accepte les chemins internes", () => {
    expect(safeRedirectPath("/dashboard/orders?filtre=retard")).toBe(
      "/dashboard/orders?filtre=retard",
    );
  });

  it.each([
    "https://exemple-malveillant.test",
    "//exemple-malveillant.test",
    "/\\exemple-malveillant.test",
    "javascript:alert(1)",
    "dashboard",
    "",
    "/\nSet-Cookie:x",
  ])("refuse %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard/today");
  });

  it("utilise la valeur par défaut si absente", () => {
    expect(safeRedirectPath(null, "/onboarding")).toBe("/onboarding");
  });
});
