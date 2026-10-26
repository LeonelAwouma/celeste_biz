import { expect, test, type Browser } from "@playwright/test";

import { SEED, acceptDialogs, login } from "./helpers";

// PNG 1×1 (fixture fictive) pour vérifier la diffusion des photos publiées.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function visitor(browser: Browser) {
  return browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 360, height: 740 },
    locale: "fr-FR",
  });
}

test("site d'Alice : brouillon, aperçu, publication explicite, retrait", async ({
  page,
  browser,
}, testInfo) => {
  // Un seul projet modifie le site d'Alice (base partagée entre projets).
  test.skip(
    testInfo.project.name !== "mobile-360",
    "parcours mobile uniquement",
  );
  acceptDialogs(page);
  const slug = `atelier-alice-${Date.now().toString(36)}`;

  await page.goto("/dashboard/website");
  const create = page.getByRole("button", { name: "Créer mon site" });
  // Premier passage : création ; passages suivants : site déjà créé.
  await expect(create.or(page.getByTestId("site-status"))).toBeVisible();
  if (await create.isVisible()) {
    await expect(
      page.getByRole("radio", { name: /Atelier de couture/ }),
    ).toBeChecked();
    await create.click();
  }
  const status = page.getByTestId("site-status");
  await expect(status).toBeVisible();

  // Brouillon : textes, adresse, prestation du catalogue.
  await page.getByLabel("Adresse du site").fill(slug);
  await page
    .getByLabel("Accroche (facultatif)")
    .fill("Couture sur mesure à Douala");
  await page
    .getByLabel("Présentation (facultatif)")
    .fill("Atelier depuis 2015.");
  await page.getByRole("checkbox", { name: /Robe sur mesure/ }).check();
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByText(/Brouillon enregistré/)).toBeVisible();

  // Photo de galerie.
  const galleryInput = page.getByLabel("Photo : Galerie");
  await galleryInput.setInputFiles({
    name: "atelier.png",
    mimeType: "image/png",
    buffer: PIXEL,
  });
  await page
    .getByRole("region", { name: /Galerie/ })
    .getByRole("button", { name: "Ajouter la photo" })
    .click();
  await expect(page.getByText("Photo ajoutée au brouillon.")).toBeVisible();

  // Rien n'est public avant publication.
  const context = await visitor(browser);
  const guest = await context.newPage();
  await guest.goto(`/sites/${slug}`);
  await expect(
    guest.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();

  // Aperçu du brouillon.
  await page.getByRole("link", { name: "Prévisualiser" }).click();
  await expect(page.getByText("Aperçu du brouillon")).toBeVisible();
  const preview = page.getByTestId("site-preview");
  await expect(preview.getByText("Couture sur mesure à Douala")).toBeVisible();
  await expect(preview.getByText(/À partir de/)).toBeVisible();
  await page.getByRole("link", { name: "Retour à l'éditeur" }).click();

  // Publication explicite.
  await page
    .getByRole("button", { name: /^Publier (le site|les modifications)$/ })
    .click();
  await expect(page.getByText(/Site publié/)).toBeVisible();
  await expect(status).toContainText("En ligne depuis");
  await expect(page.getByTestId("site-public-url")).toContainText(
    `/sites/${slug}`,
  );

  await guest.goto(`/sites/${slug}`);
  await expect(
    guest.getByRole("heading", { level: 1, name: "Atelier Alice" }),
  ).toBeVisible();
  await expect(guest.getByText("Couture sur mesure à Douala")).toBeVisible();
  await expect(
    guest.getByRole("heading", { name: "Nos créations" }),
  ).toBeVisible();
  await expect(guest.getByText("Robe sur mesure")).toBeVisible();
  await expect(guest.locator("body")).not.toContainText("Mireille");
  const photo = guest.getByRole("img", { name: /Photo 1 de Atelier Alice/ });
  const src = await photo.getAttribute("src");
  const image = await guest.request.get(src!);
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect(
    await guest.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);

  // Une modification du brouillon n'est pas publiée implicitement.
  await page
    .getByLabel("Accroche (facultatif)")
    .fill("Nouvelle accroche non publiée");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByText(/Brouillon enregistré/)).toBeVisible();
  await expect(status).toContainText("pas encore publiées");
  await guest.reload();
  await expect(guest.getByText("Couture sur mesure à Douala")).toBeVisible();
  await expect(guest.locator("body")).not.toContainText("Nouvelle accroche");

  // Retrait : l'adresse et les photos ne montrent plus rien.
  await page.getByRole("button", { name: "Retirer le site" }).click();
  await expect(page.getByText(/Site retiré/)).toBeVisible();
  await guest.reload();
  await expect(
    guest.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
  expect((await guest.request.get(src!)).status()).toBe(404);
  await context.close();
});

test("site publié de démonstration : prestations, prix, contact WhatsApp", async ({
  browser,
}) => {
  const context = await visitor(browser);
  const guest = await context.newPage();
  await guest.goto("/sites/delices-de-bob");
  await expect(
    guest.getByRole("heading", { level: 1, name: "Délices de Bob" }),
  ).toBeVisible();
  await expect(guest).toHaveTitle("Délices de Bob");
  await expect(
    guest.getByRole("heading", { name: "Menus et produits" }),
  ).toBeVisible();
  await expect(guest.getByText(/À partir de 15\s000\sFCFA/)).toBeVisible();
  await expect(guest.getByTestId("site-whatsapp").first()).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/237690000002\?text=Bonjour%2C/,
  );
  // Fichier non publié : jamais servi, même avec un chemin plausible.
  const missing = await guest.request.get(
    "/sites/delices-de-bob/media/s/bbbbbbbb-0000-4000-8000-000000000001/11111111-1111-4111-8111-111111111111.webp",
  );
  expect(missing.status()).toBe(404);
  await context.close();
});

test("un employé voit le site sans pouvoir le modifier", async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await login(page, SEED.sam);
  await page.goto("/dashboard/website");
  await expect(page.getByRole("heading", { name: "Mon site" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enregistrer le brouillon" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Créer mon site" }),
  ).toHaveCount(0);
  await context.close();
});
