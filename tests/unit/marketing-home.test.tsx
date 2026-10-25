import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MarketingHome from "@/app/(marketing)/page";

describe("page d'accueil marketing", () => {
  const html = renderToStaticMarkup(<MarketingHome />);

  it("affiche la promesse en français", () => {
    expect(html).toContain("Continuez à vendre comme vous en avez");
    expect(html).toContain("sans vous obliger à créer un site web");
  });

  it("présente le site web comme facultatif", () => {
    expect(html).toContain("Site web facultatif");
  });

  it("propose l'inscription et la connexion", () => {
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
  });
});
