import { expect, test } from "@playwright/test";

import {
  SEED,
  acceptDialogs,
  createBusiness,
  latestAuthLink,
  login,
  signUpAndConfirm,
  uniqueEmail,
} from "./helpers";

test.use({ storageState: { cookies: [], origins: [] } });

test("le profil couture configure mesures, essayage et étapes de confection", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("couture"), "Pilote2026");
  await createBusiness(page, "Atelier Test Couture", /Couture et confection/);

  const main = page.getByRole("main");
  await expect(main).toContainText("Configuré pour : Couture et confection");
  const fields = page.getByRole("list", { name: "Champs de commande" });
  await expect(fields).toContainText("Type de vêtement");
  await expect(fields).toContainText("Mesures (privé)");
  await expect(fields).not.toContainText("portions");
  await expect(main).toContainText("Coupe → Assemblage → Essayage → Finitions");
  await expect(main).toContainText("Ajouter votre première prestation");
  // Le site reste une étape facultative.
  await expect(
    page.getByRole("link", { name: /Créer mon site\s*facultatif/ }),
  ).toBeVisible();
});

test("le profil traiteur configure date d'événement, portions et livraison", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("traiteur"), "Pilote2026");
  await createBusiness(page, "Délices Test", /Pâtisserie et traiteur/);

  const fields = page.getByRole("list", { name: "Champs de commande" });
  await expect(fields).toContainText("Date et heure de l'événement");
  await expect(fields).toContainText("Nombre de portions ou d'invités");
  await expect(fields).toContainText("Mode de remise");
  await expect(fields).not.toContainText("Mesures");
  await expect(page.getByRole("main")).toContainText("événements");
});

test("l'onboarding valide le numéro WhatsApp sans perdre la saisie", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("whatsapp"), "Pilote2026");
  await page.getByLabel("Nom commercial").fill("Boutique Test");
  await page.getByRole("radio", { name: /Autre activité/ }).check();
  await page.getByLabel(/Numéro WhatsApp/).fill("12 34");
  await page.getByRole("button", { name: "Créer mon entreprise" }).click();

  await expect(page.getByText(/Numéro invalide/)).toBeVisible();
  await expect(page.getByLabel("Nom commercial")).toHaveValue("Boutique Test");
  await expect(
    page.getByRole("radio", { name: /Autre activité/ }),
  ).toBeChecked();

  await page.getByLabel(/Numéro WhatsApp/).fill("6 77 12 34 56");
  await page.getByRole("button", { name: "Créer mon entreprise" }).click();
  await expect(page).toHaveURL(/\/dashboard\/today$/);

  await page.goto("/dashboard/settings");
  await expect(page.getByLabel(/Numéro WhatsApp/)).toHaveValue(
    "+237 6 77 12 34 56",
  );
});

test("le propriétaire peut désactiver le site web facultatif", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("modules"), "Pilote2026");
  await createBusiness(page, "Sans Site", /Autre activité/);

  await page.goto("/dashboard/settings");
  await page.getByRole("checkbox", { name: /Mon site/ }).uncheck();
  await page.getByRole("button", { name: "Enregistrer les modules" }).click();
  await expect(page.getByText("Modules enregistrés.")).toBeVisible();

  await page.goto("/dashboard/more");
  await expect(
    page.getByRole("main").getByRole("link", { name: /Mon site/ }),
  ).toHaveCount(0);
  await page.goto("/dashboard/website");
  await expect(page.getByText("Module « Mon site » désactivé")).toBeVisible();
  await page.goto("/dashboard/today");
  await expect(page.getByRole("link", { name: /Créer mon site/ })).toHaveCount(
    0,
  );
});

test("un employé consulte les paramètres sans pouvoir les modifier", async ({
  page,
}) => {
  await login(page, SEED.sam);
  await page.goto("/dashboard/settings");
  await expect(page.getByText("Votre rôle : Employé.")).toBeVisible();
  await expect(page.getByLabel("Nom commercial")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enregistrer" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Inviter un membre")).toHaveCount(0);
});

test("invitation : lien partagé, inscription de l'employé, accès à l'entreprise", async ({
  page,
  browser,
}) => {
  acceptDialogs(page);
  await signUpAndConfirm(page, uniqueEmail("patron"), "Pilote2026");
  await createBusiness(page, "Atelier Invitation", /Couture et confection/);

  const employee = uniqueEmail("employe");
  await page.goto("/dashboard/settings");
  await page.getByLabel("Adresse e-mail de la personne").fill(employee);
  await page.getByLabel("Rôle", { exact: true }).selectOption("staff");
  await page
    .getByRole("button", { name: "Créer un lien d'invitation" })
    .click();
  const link = (await page
    .getByTestId("invitation-link")
    .textContent())!.trim();
  expect(link).toMatch(/\/invitation\/[A-Za-z0-9_-]{43}$/);
  await expect(
    page.getByRole("list", { name: "Invitations en attente" }),
  ).toContainText(employee);

  // L'employé ouvre le lien sur son propre téléphone.
  const other = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const phone = await other.newPage();
  await phone.goto(link);
  await expect(
    phone.getByRole("heading", { name: "Vous êtes invité" }),
  ).toBeVisible();
  await expect(phone.getByRole("main")).not.toContainText("Atelier Invitation");

  await phone.getByRole("link", { name: "Créer mon compte" }).click();
  await phone.getByLabel("Votre nom").fill("Employé Test");
  await phone.getByLabel("Adresse e-mail").fill(employee);
  await phone.getByLabel("Mot de passe").fill("Employe2026");
  await phone.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(phone.getByText(/Ouvrez le lien envoyé/)).toBeVisible();

  await phone.goto(await latestAuthLink(employee, /Confirmez/));
  await expect(
    phone.getByRole("heading", { name: "Rejoindre Atelier Invitation" }),
  ).toBeVisible();
  await phone.getByRole("button", { name: "Accepter l'invitation" }).click();
  await expect(phone).toHaveURL(/\/dashboard\/today$/);
  await expect(phone.locator("header")).toContainText("Atelier Invitation");
  await expect(phone.locator("header")).toContainText("Employé");

  // Le lien ne sert qu'une fois.
  await phone.goto(link);
  await expect(
    phone.getByRole("heading", { name: "Invitation indisponible" }),
  ).toBeVisible();
  await other.close();

  // Le propriétaire voit le nouveau membre et peut lui retirer l'accès.
  await page.goto("/dashboard/settings");
  const members = page.getByRole("list", { name: "Membres" });
  await expect(members).toContainText("Employé Test");
  await members
    .getByRole("listitem")
    .filter({ hasText: "Employé Test" })
    .getByRole("button", { name: "Retirer l'accès" })
    .click();
  // La ligne du membre disparaît dès que l'accès est retiré.
  await expect(members).not.toContainText("Employé Test");
});

test("une invitation ouverte avec un autre compte est refusée", async ({
  page,
}) => {
  await signUpAndConfirm(page, uniqueEmail("patron2"), "Pilote2026");
  await createBusiness(page, "Atelier Privé", /Autre activité/);
  await page.goto("/dashboard/settings");
  await page
    .getByLabel("Adresse e-mail de la personne")
    .fill(uniqueEmail("cible"));
  await page
    .getByRole("button", { name: "Créer un lien d'invitation" })
    .click();
  const link = (await page
    .getByTestId("invitation-link")
    .textContent())!.trim();

  await page.context().clearCookies();
  await login(page, SEED.bob);
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Mauvais compte" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accepter l'invitation" }),
  ).toHaveCount(0);
});

test("un lien d'invitation forgé ne révèle rien", async ({ page }) => {
  await login(page, SEED.bob);
  await page.goto(`/invitation/${"A".repeat(43)}`);
  await expect(
    page.getByRole("heading", { name: "Invitation indisponible" }),
  ).toBeVisible();
});
