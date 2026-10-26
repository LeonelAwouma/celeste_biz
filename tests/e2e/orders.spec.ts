import { expect, test, type Page } from "@playwright/test";

import { SEED, login } from "./helpers";

const NNBSP = " ";
const xaf = (amount: string) => `${amount.replace(" ", NNBSP)} FCFA`;

function suffix() {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

async function pickCustomer(page: Page, name: string) {
  await page.getByPlaceholder("Nom ou téléphone du client").fill(name);
  await page
    .getByRole("list", { name: "Clients trouvés" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

test("commande complète : catalogue, acompte, états, solde et clôture", async ({
  page,
}) => {
  await page.goto("/dashboard/orders/new");
  await pickCustomer(page, "Paul Etoga");

  const option = page.locator("#add-catalog-item option", {
    hasText: "Retouche simple",
  });
  await page
    .getByRole("combobox", { name: "Ajouter depuis le catalogue" })
    .selectOption((await option.getAttribute("value"))!);
  await expect(
    page.getByRole("textbox", { name: "Libellé de la ligne 1" }),
  ).toHaveValue("Retouche simple");
  await page.getByRole("textbox", { name: "Quantité de la ligne 1" }).fill("3");
  await page.getByRole("button", { name: "Ajouter une ligne libre" }).click();
  await page
    .getByRole("textbox", { name: "Libellé de la ligne 2" })
    .fill("Ourlet express");
  await page
    .getByRole("textbox", { name: "Prix unitaire de la ligne 2" })
    .fill("1 500");
  await expect(page.getByTestId("order-total")).toHaveText(xaf("9 000"));

  await page
    .getByRole("combobox", { name: "Type de vêtement" })
    .selectOption("retouche");
  await page.getByRole("textbox", { name: "Montant (FCFA)" }).fill("4000");
  await page
    .getByRole("combobox", { name: "Moyen" })
    .selectOption("mobile_money");
  await page
    .getByRole("textbox", { name: /Référence de la transaction/ })
    .fill("MP-E2E-1");
  await page.getByRole("button", { name: "Enregistrer la commande" }).click();

  await expect(page).toHaveURL(
    /\/dashboard\/orders\/[0-9a-f-]{36}\?enregistre=1$/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^CMD-\d{4}-\d{4,}$/,
  );
  await expect(page.getByTestId("order-amount-total")).toHaveText(xaf("9 000"));
  await expect(page.getByTestId("order-amount-paid")).toHaveText(xaf("4 000"));
  await expect(page.getByTestId("order-amount-balance")).toHaveText(
    xaf("5 000"),
  );
  const payments = page.getByRole("list", {
    name: "Encaissements enregistrés",
  });
  await expect(payments).toContainText("Mobile Money");
  await expect(payments).toContainText("non vérifié auprès de l'opérateur");

  await page.getByRole("button", { name: "Démarrer la réalisation" }).click();
  await expect(page.getByText("En confection").first()).toBeVisible();
  await page.getByRole("button", { name: "Marquer comme prête" }).click();
  await page
    .getByRole("button", { name: "Marquer comme remise au client" })
    .click();
  await expect(page.getByRole("button", { name: "Clôturer" })).toBeDisabled();
  await expect(
    page.getByText("Encaissez le solde avant de clôturer."),
  ).toBeVisible();

  // Le montant proposé est le solde restant.
  await expect(
    page.getByRole("textbox", { name: "Montant (FCFA)" }),
  ).toHaveValue("5000");
  await page.getByRole("textbox", { name: "Montant (FCFA)" }).fill("6000");
  await page
    .getByRole("button", { name: "Enregistrer l'encaissement" })
    .click();
  await expect(page.getByText(/dépasse le solde restant/)).toBeVisible();
  await page.getByRole("textbox", { name: "Montant (FCFA)" }).fill("5000");
  await page
    .getByRole("button", { name: "Enregistrer l'encaissement" })
    .click();
  await expect(page.getByTestId("order-amount-balance")).toHaveText("Soldée");

  await page.getByRole("button", { name: "Clôturer" }).click();
  await expect(
    page.getByRole("main").getByText("Clôturée").first(),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Modifier" })).toHaveCount(0);
  const history = page.getByRole("list", { name: "Historique de la commande" });
  await expect(history).toContainText("Livrée → Clôturée");
  await expect(history).toContainText("Encaissement déclaré");
});

test("nouveau client, brouillon modifiable puis lignes figées après confirmation", async ({
  page,
}) => {
  const name = `Client commande ${suffix()}`;
  await page.goto("/dashboard/orders/new");
  await page.getByRole("button", { name: "Nouveau client" }).click();
  await page
    .getByRole("textbox", { name: "Nom ou surnom du nouveau client" })
    .fill(name);

  // Champ métier obligatoire manquant : erreur, saisie conservée.
  await page
    .getByRole("textbox", { name: "Libellé de la ligne 1" })
    .fill("Chemise");
  await page
    .getByRole("textbox", { name: "Prix unitaire de la ligne 1" })
    .fill("12000");
  await page
    .getByRole("checkbox", { name: "Enregistrer comme brouillon" })
    .check();
  await page.getByRole("button", { name: "Enregistrer la commande" }).click();
  await expect(
    page.getByText("« Type de vêtement » est obligatoire."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Libellé de la ligne 1" }),
  ).toHaveValue("Chemise");
  await expect(
    page.getByRole("textbox", { name: "Nom ou surnom du nouveau client" }),
  ).toHaveValue(name);

  await page
    .getByRole("combobox", { name: "Type de vêtement" })
    .selectOption("chemise");
  await page.getByRole("button", { name: "Enregistrer la commande" }).click();
  await expect(page).toHaveURL(/\?enregistre=1$/);
  await expect(
    page.getByRole("main").getByText("Brouillon").first(),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(name);

  await page.getByRole("link", { name: "Modifier" }).click();
  await page.getByRole("textbox", { name: "Quantité de la ligne 1" }).fill("2");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page).toHaveURL(/\?modifie=1$/);
  await expect(page.getByTestId("order-amount-total")).toHaveText(
    xaf("24 000"),
  );

  await page.getByRole("button", { name: "Confirmer la commande" }).click();
  await expect(
    page.getByRole("main").getByText("Confirmée").first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Modifier" }).click();
  await expect(
    page.getByText(/le client, les lignes et les prix sont figés/),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Quantité de la ligne 1" }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Notes internes (facultatif)" })
    .fill("Boutons nacrés");
  await page
    .getByRole("button", { name: "Enregistrer les modifications" })
    .click();
  await expect(page).toHaveURL(/\?modifie=1$/);
  await expect(page.getByRole("main")).toContainText("Boutons nacrés");
  await expect(page.getByTestId("order-amount-total")).toHaveText(
    xaf("24 000"),
  );

  // La fiche client montre la commande et son solde.
  await page.getByRole("link", { name: name }).first().click();
  await expect(
    page.getByRole("list", { name: "Commandes du client" }),
  ).toContainText("CMD-");
  await expect(page.getByText(/Reste à payer sur ses commandes/)).toContainText(
    xaf("24 000"),
  );
});

test("filtres : en retard et à encaisser", async ({ page }) => {
  await page.goto("/dashboard/orders?filtre=late");
  const list = page.getByRole("list", { name: "Liste des commandes" });
  await expect(list).toContainText("Paul Etoga");
  await expect(list).toContainText("En retard");
  await page.getByRole("link", { name: "À encaisser" }).click();
  await expect(
    page.getByRole("list", { name: "Liste des commandes" }),
  ).toContainText("Mireille Ngo");
  await page.getByRole("link", { name: "Terminées" }).click();
  await expect(
    page.getByRole("list", { name: "Liste des commandes" }),
  ).toContainText("Clôturée");
});

test.describe("rôles et isolement", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("l'employé crée et fait avancer, mais n'annule pas ; la propriétaire annule avec motif", async ({
    browser,
  }) => {
    const staff = await browser.newPage();
    await login(staff, SEED.sam);
    await staff.goto("/dashboard/orders/new");
    await pickCustomer(staff, "Mireille Ngo");
    await staff
      .getByRole("textbox", { name: "Libellé de la ligne 1" })
      .fill(`Jupe ${suffix()}`);
    await staff
      .getByRole("textbox", { name: "Prix unitaire de la ligne 1" })
      .fill("8000");
    await staff
      .getByRole("combobox", { name: "Type de vêtement" })
      .selectOption("pantalon");
    await staff
      .getByRole("button", { name: "Enregistrer la commande" })
      .click();
    await expect(staff).toHaveURL(/\?enregistre=1$/);
    const url = staff.url().replace(/\?.*$/, "");
    await expect(
      staff.getByRole("button", { name: "Démarrer la réalisation" }),
    ).toBeVisible();
    await expect(
      staff.getByRole("button", { name: "Annuler la commande" }),
    ).toHaveCount(0);
    await staff.close();

    const owner = await browser.newPage();
    await login(owner, SEED.alice);
    await owner.goto(url);
    await owner.getByRole("button", { name: "Annuler la commande" }).click();
    await owner.getByRole("button", { name: "Confirmer" }).click();
    await expect(
      owner.getByText("Indiquez le motif de l'annulation.").first(),
    ).toBeVisible();
    await owner
      .getByRole("textbox", { name: "Motif de l'annulation" })
      .fill("Cliente a changé d'avis");
    await owner.getByRole("button", { name: "Confirmer" }).click();
    await expect(
      owner.getByText("Annulée — motif : Cliente a changé d'avis", {
        exact: true,
      }),
    ).toBeVisible();
    await owner.close();
  });

  test("une commande d'une autre entreprise est introuvable", async ({
    page,
  }) => {
    await login(page, SEED.bob);
    await page.goto("/dashboard/orders/0da00000-0000-4000-8000-000000000001");
    await expect(page.getByRole("main")).toContainText(
      /introuvable|n'existe pas/i,
    );
    await page.goto("/dashboard/orders?filtre=all");
    await expect(
      page.getByRole("list", { name: "Liste des commandes" }),
    ).not.toContainText("Mireille");
  });
});
