import { expect, test, type Page } from "@playwright/test";

import { SEED, acceptDialogs, login } from "./helpers";

const NNBSP = " ";
const xaf = (amount: string) => `${amount.replace(" ", NNBSP)} FCFA`;

async function pickCustomer(page: Page, name: string) {
  await page.getByPlaceholder("Nom ou téléphone du client").fill(name);
  await page
    .getByRole("list", { name: "Clients trouvés" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

async function expectPdf(page: Page, url: string) {
  const response = await page.request.get(url);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("application/pdf");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = await response.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
}

test("devis : création, envoi, acceptation déclarée, commande puis brouillon de facture", async ({
  page,
}) => {
  acceptDialogs(page);
  await page.goto("/dashboard/quotes/new");
  await pickCustomer(page, "Paul Etoga");
  await page
    .getByRole("textbox", { name: "Libellé de la ligne 1" })
    .fill("Robe de cérémonie");
  await page
    .getByRole("textbox", { name: "Prix unitaire de la ligne 1" })
    .fill("45 000");
  await expect(page.getByTestId("quote-total")).toHaveText(xaf("45 000"));
  await page
    .getByRole("textbox", { name: "Conditions (facultatif)" })
    .fill("Acompte de 50 % à la commande.");
  await page.getByRole("button", { name: "Enregistrer le devis" }).click();

  await expect(page).toHaveURL(
    /\/dashboard\/quotes\/[0-9a-f-]{36}\?enregistre=1$/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^DEV-\d{4}-\d{4,}$/,
  );
  await expect(
    page
      .getByRole("list", { name: "Lignes du devis" })
      .getByTestId("document-total"),
  ).toHaveText(xaf("45 000"));
  const quoteUrl = new URL(page.url()).pathname;
  await expectPdf(page, `${quoteUrl}/pdf`);
  await expect(page.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/237\d+\?text=/,
  );

  await page.getByRole("button", { name: "Marquer comme envoyé" }).click();
  await expect(page.getByText("Envoyé").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);

  await page.getByRole("button", { name: "Le client a accepté" }).click();
  await page
    .getByRole("textbox", { name: /Comment le client a-t-il accepté/ })
    .fill("Accord par WhatsApp");
  await page.getByRole("button", { name: "Confirmer" }).click();
  await expect(page.getByTestId("quote-decision")).toContainText(
    "Acceptation déclarée manuellement",
  );
  await expect(page.getByTestId("quote-decision")).toContainText(
    "Accord par WhatsApp",
  );

  await page.getByRole("button", { name: "Créer la commande" }).click();
  await expect(page).toHaveURL(
    /\/dashboard\/orders\/[0-9a-f-]{36}\?depuis_devis=1$/,
  );
  await expect(page.getByTestId("order-amount-total")).toHaveText(
    xaf("45 000"),
  );
  await expect(
    page.getByText("Commande créée à partir du devis accepté."),
  ).toBeVisible();

  // Facture : brouillon sans numéro, émission verrouillée.
  await page.getByRole("button", { name: "Préparer une facture" }).click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Brouillon de facture",
  );
  await expect(
    page
      .getByRole("list", { name: "Lignes de la facture" })
      .getByTestId("document-total"),
  ).toHaveText(xaf("45 000"));
  await expect(page.getByTestId("issue-disabled-reason")).toContainText(
    "conformité fiscale",
  );
  await expect(
    page.getByRole("button", { name: "Émettre la facture" }),
  ).toBeDisabled();
  const invoiceUrl = new URL(page.url()).pathname;
  await expectPdf(page, `${invoiceUrl}/pdf`);

  await page
    .getByRole("textbox", { name: /Conditions de paiement/ })
    .fill("Payable à réception.");
  await page.getByRole("button", { name: "Enregistrer le brouillon" }).click();
  await expect(page.getByText("Brouillon enregistré.")).toBeVisible();
  await expect(page.getByText("Payable à réception.").first()).toBeVisible();

  await page.getByRole("button", { name: "Abandonner le brouillon" }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText("Aucune facture pour cette commande."),
  ).toBeVisible();
});

test("reçu PDF d'un encaissement déclaré", async ({ page }) => {
  await page.goto("/dashboard/orders/0da00000-0000-4000-8000-000000000001");
  const receipt = page.getByRole("link", { name: "Reçu PDF" }).first();
  await expect(receipt).toBeVisible();
  await expectPdf(page, (await receipt.getAttribute("href"))!);
});

test("profil de facturation enregistré par la propriétaire", async ({
  page,
}) => {
  await page.goto("/dashboard/settings#facturation");
  const card = page.locator("#facturation");
  await card
    .getByRole("textbox", { name: "Raison sociale ou nom légal" })
    .fill("Atelier Mireille SARL");
  await card
    .getByRole("textbox", { name: "NIU (facultatif)" })
    .fill("M000000000000X");
  await card.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    card.getByText("Profil de facturation enregistré."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator("#facturation")
      .getByRole("textbox", { name: "Raison sociale ou nom légal" }),
  ).toHaveValue("Atelier Mireille SARL");
});

test("le filtre « En cours » montre le devis de démonstration", async ({
  page,
}) => {
  await page.goto("/dashboard/quotes");
  const list = page.getByRole("list", { name: "Liste des devis" });
  await expect(list.getByText("Paul Etoga").first()).toBeVisible();
  await page.goto("/dashboard/quotes/0fa00000-0000-4000-8000-000000000001");
  await expect(
    page
      .getByRole("list", { name: "Lignes du devis" })
      .getByTestId("document-total"),
  ).toHaveText(xaf("82 000"));
});

test.describe("autres comptes", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("l'employé ne prépare pas de facture et n'annule pas un devis", async ({
    page,
  }) => {
    await login(page, SEED.sam);
    await page.goto("/dashboard/orders/0da00000-0000-4000-8000-000000000001");
    await expect(
      page.getByRole("heading", { name: "Facturation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Préparer une facture" }),
    ).toHaveCount(0);
    await page.goto("/dashboard/quotes/0fa00000-0000-4000-8000-000000000001");
    await expect(
      page.getByRole("button", { name: "Le client a accepté" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Annuler le devis" }),
    ).toHaveCount(0);
  });

  test("un devis d'une autre entreprise est introuvable", async ({ page }) => {
    await login(page, SEED.bob);
    await page.goto("/dashboard/quotes/0fa00000-0000-4000-8000-000000000001");
    await expect(page.getByRole("main")).toContainText(
      /introuvable|n'existe pas/i,
    );
    const pdf = await page.request.get(
      "/dashboard/quotes/0fa00000-0000-4000-8000-000000000001/pdf",
    );
    expect(pdf.status()).toBe(404);
  });
});
