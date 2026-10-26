import { expect, test } from "@playwright/test";

import { acceptDialogs } from "./helpers";

// PNG 1×1 valide.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function suffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

test("créer un article à prix « à partir de », le passer sur devis puis l'archiver", async ({
  page,
}) => {
  acceptDialogs(page);
  const name = `Boubou E2E ${suffix()}`;

  await page.goto("/dashboard/catalog");
  await expect(page.getByRole("main")).toContainText("Modèles et prestations");
  await page.getByRole("main").getByRole("link", { name: "Nouveau" }).click();

  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Prix", { exact: true }).selectOption("from");
  await page.getByLabel("Montant minimum (FCFA)").fill("abc");
  await page.getByRole("button", { name: "Enregistrer l'article" }).click();
  await expect(page.getByText(/Indiquez un prix valide/)).toBeVisible();

  await page.getByLabel("Montant minimum (FCFA)").fill("35 000");
  await page.getByLabel("Catégorie (facultatif)").fill("Tenues E2E");
  await page.getByRole("button", { name: "Enregistrer l'article" }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/catalog\/[0-9a-f-]{36}\?enregistre=1$/,
  );
  await expect(page.getByRole("main")).toContainText("À partir de 35 000 FCFA");

  await page.goto("/dashboard/catalog?q=Tenues%20E2E");
  const group = page.getByRole("region", { name: "Tenues E2E" });
  await expect(
    group.getByRole("link", { name: new RegExp(name) }),
  ).toContainText("À partir de 35 000 FCFA");
  await group.getByRole("link", { name: new RegExp(name) }).click();

  await page.getByLabel("Prix", { exact: true }).selectOption("quote");
  await expect(page.getByLabel(/Montant/)).toHaveCount(0);
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("main")).toContainText("Sur devis");

  await page.getByRole("button", { name: "Archiver l'article" }).click();
  await expect(
    page.getByRole("button", { name: "Restaurer l'article" }),
  ).toBeVisible();
  await page.goto("/dashboard/catalog?archives=1");
  await expect(
    page.getByRole("link", { name: new RegExp(name) }),
  ).toBeVisible();
});

test("ajouter puis retirer la photo d'un article (format vérifié)", async ({
  page,
}) => {
  acceptDialogs(page);
  const name = `Retouche photo ${suffix()}`;

  await page.goto("/dashboard/catalog/new");
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Montant (FCFA)").fill("2500");
  await page.getByRole("button", { name: "Enregistrer l'article" }).click();
  await expect(page).toHaveURL(/\?enregistre=1$/);

  const fileInput = page.locator('input[type="file"][name="image"]');
  // Un faux fichier image (contenu texte) est refusé par le serveur.
  await fileInput.setInputFiles({
    name: "piege.png",
    mimeType: "image/png",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await page.getByRole("button", { name: "Enregistrer la photo" }).click();
  await expect(page.getByText(/Format non accepté/)).toBeVisible();

  await fileInput.setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Enregistrer la photo" }).click();
  await expect(page.getByText("Photo enregistrée.")).toBeVisible();
  const image = page.getByRole("img", { name: `Photo : ${name}` });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute(
    "src",
    /\/storage\/v1\/object\/sign\/catalog-images\//,
  );
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);

  // Une grande photo est réduite dans le navigateur (WebP, 1200 px max).
  const bigPng = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2400;
    canvas.height = 1800;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 2400, 1800);
    gradient.addColorStop(0, "#7c3aed");
    gradient.addColorStop(1, "#f59e0b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2400, 1800);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await fileInput.setInputFiles({
    name: "grande.png",
    mimeType: "image/png",
    buffer: Buffer.from(bigPng, "base64"),
  });
  await expect(page.getByText(/grande\.png \(\d+ Ko\)/)).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer la photo" }).click();
  await expect(image).toHaveAttribute("src", /\.webp\?/);
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1200);

  await page.getByRole("button", { name: "Retirer la photo" }).click();
  await expect(page.getByText("Aucune photo.")).toBeVisible();
});
