import { expect, test, type Page } from "@playwright/test";

const DASHBOARD_PAGES = [
  ["/dashboard/today", "Aujourd'hui"],
  ["/dashboard/orders", "Commandes"],
  ["/dashboard/orders/new", "Nouvelle commande"],
  ["/dashboard/customers", "Clients"],
  ["/dashboard/invoices", "Factures"],
  ["/dashboard/catalog", "Catalogue"],
  ["/dashboard/website", "Mon site"],
  ["/dashboard/settings", "Paramètres"],
  ["/dashboard/quotes", "Devis"],
  ["/dashboard/payments", "Encaissements"],
  ["/dashboard/more", "Plus"],
] as const;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("la page d'accueil présente la promesse et l'inscription", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(
    page.getByRole("heading", { level: 1, name: /Continuez à vendre/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Créer mon compte" }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("chaque espace s'affiche sans défilement horizontal", async ({ page }) => {
  for (const [path, title] of DASHBOARD_PAGES) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
  }
});

test("/dashboard redirige vers « Aujourd'hui »", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard\/today$/);
});

test("le lien d'évitement mène au contenu au clavier", async ({ page }) => {
  await page.goto("/dashboard/today");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);
  await expect(page.locator("main#contenu")).toBeFocused();
});

test("une route de suivi inconnue répond « page introuvable »", async ({
  page,
}) => {
  const response = await page.goto("/suivi/jeton-inexistant");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "parcours mobile uniquement");

  test("la barre d'onglets navigue et indique l'onglet actif", async ({
    page,
  }) => {
    await page.goto("/dashboard/today");
    const tabs = page.getByRole("navigation", {
      name: "Navigation principale",
    });
    await tabs.getByRole("link", { name: "Commandes" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders$/);
    await expect(tabs.getByRole("link", { name: "Commandes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("les onglets offrent une cible tactile d'au moins 44 px", async ({
    page,
  }) => {
    await page.goto("/dashboard/today");
    const links = page
      .getByRole("navigation", { name: "Navigation principale" })
      .getByRole("link");
    for (const link of await links.all()) {
      const box = await link.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("« Plus » donne accès au site facultatif et aux paramètres", async ({
    page,
  }) => {
    await page.goto("/dashboard/more");
    await expect(page.getByText("(facultatif)")).toBeVisible();
    await page.getByRole("link", { name: /Paramètres/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/settings$/);
  });

  test("le bouton « Nouvelle commande » reste accessible", async ({ page }) => {
    await page.goto("/dashboard/customers");
    const cta = page.getByRole("link", { name: "Nouvelle commande" });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/dashboard\/orders\/new$/);
  });
});

test.describe("grand écran", () => {
  test.skip(({ isMobile }) => isMobile, "parcours grand écran uniquement");

  test("la barre latérale remplace les onglets", async ({ page }) => {
    await page.goto("/dashboard/today");
    const sidebar = page.locator("aside nav");
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole("link")).toHaveCount(9);
    // La navigation est diffusée en flux : attendre la version finale.
    const tabs = page.locator("nav.fixed").filter({ hasText: "Plus" });
    await expect(tabs).toHaveCount(1);
    await expect(tabs).toBeHidden();
  });
});
