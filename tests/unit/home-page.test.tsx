import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("page d'accueil", () => {
  it("affiche la promesse en français", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Céleste Biz");
    expect(html).toContain("sans vous obliger à créer un site web");
  });
});
