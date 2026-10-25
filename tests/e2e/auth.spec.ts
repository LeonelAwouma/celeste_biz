import { expect, test } from "@playwright/test";

import {
  SEED,
  createBusiness,
  latestAuthLink,
  login,
  signUpAndConfirm,
  uniqueEmail,
} from "./helpers";

// Ces parcours partent d'un navigateur non connecté.
test.use({ storageState: { cookies: [], origins: [] } });

const header = (page: import("@playwright/test").Page) =>
  page.locator("header");

test("l'espace protégé renvoie vers la connexion puis vers la page demandée", async ({
  page,
}) => {
  await page.goto("/dashboard/orders");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard%2Forders$/);

  await page.getByLabel("Adresse e-mail").fill(SEED.alice);
  await page.getByLabel("Mot de passe").fill("Motdepasse123");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page).toHaveURL(/\/dashboard\/orders$/);
  await expect(header(page)).toContainText("Atelier Alice");
});

test("un mot de passe erroné donne un message neutre", async ({ page }) => {
  await login(page, SEED.alice, "MauvaisMotdepasse1");
  await expect(
    page.getByText("E-mail ou mot de passe incorrect."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  // L'adresse saisie est conservée, le mot de passe non.
  await expect(page.getByLabel("Adresse e-mail")).toHaveValue(SEED.alice);
  await expect(page.getByLabel("Mot de passe")).toHaveValue("");
});

test("la redirection après connexion reste interne", async ({ page }) => {
  await page.goto("/login?next=//exemple-malveillant.test");
  await page.getByLabel("Adresse e-mail").fill(SEED.alice);
  await page.getByLabel("Mot de passe").fill("Motdepasse123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/localhost:3100\/dashboard\/today$/);
});

test("un lien de confirmation invalide est refusé", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=faux&type=email");
  await expect(page).toHaveURL(/\/login\?erreur=lien$/);
  await expect(
    page.getByText(/Ce lien est invalide ou a expiré/),
  ).toBeVisible();
});

test("inscription, confirmation, création d'entreprise et changement d'entreprise", async ({
  page,
}) => {
  const email = uniqueEmail("inscription");
  await signUpAndConfirm(page, email, "Pilote2026");

  // Sans entreprise, l'espace renvoie vers la création.
  await page.goto("/dashboard/today");
  await expect(page).toHaveURL(/\/onboarding$/);

  await createBusiness(page, "Couture Étoile");
  await expect(header(page)).toContainText("Couture Étoile");
  await expect(header(page)).toContainText("Propriétaire");

  await createBusiness(page, "Traiteur Étoile");
  const switcher = page.getByLabel("Entreprise active");
  await expect(switcher.locator("option")).toHaveText([
    "Couture Étoile",
    "Traiteur Étoile",
  ]);
  await expect(switcher.locator("option:checked")).toHaveText(
    "Traiteur Étoile",
  );

  const saved = page.waitForResponse(
    (response) => response.request().method() === "POST",
  );
  await switcher.selectOption({ label: "Couture Étoile" });
  await saved;
  await expect(switcher).toBeEnabled();
  await page.reload();
  await expect(switcher.locator("option:checked")).toHaveText("Couture Étoile");
});

test("mot de passe oublié : lien e-mail puis nouveau mot de passe", async ({
  page,
}) => {
  const email = uniqueEmail("reset");
  await signUpAndConfirm(page, email, "Ancien2026");
  await page.context().clearCookies();

  await page.goto("/reset-password");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByRole("button", { name: "Recevoir un lien" }).click();
  await expect(page.getByText(/Si un compte existe/)).toBeVisible();

  await page.goto(await latestAuthLink(email, /Réinitialisez/));
  await expect(page).toHaveURL(/\/update-password$/);
  await page.getByLabel("Nouveau mot de passe").fill("Nouveau2026");
  await page.getByLabel("Confirmez le mot de passe").fill("Nouveau2026");
  await page
    .getByRole("button", { name: "Enregistrer le mot de passe" })
    .click();
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.context().clearCookies();
  await login(page, email, "Nouveau2026");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("la demande de réinitialisation ne révèle pas si le compte existe", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await page.getByLabel("Adresse e-mail").fill(uniqueEmail("inconnu"));
  await page.getByRole("button", { name: "Recevoir un lien" }).click();
  await expect(page.getByText(/Si un compte existe/)).toBeVisible();
});

test("Bob ne voit jamais l'entreprise d'Alice, même en forgeant le cookie", async ({
  page,
  context,
}) => {
  await login(page, SEED.bob);
  await expect(header(page)).toContainText("Délices de Bob");

  await context.addCookies([
    {
      name: "cb_active_business",
      value: SEED.businessA,
      url: "http://localhost:3100",
    },
  ]);
  await page.reload();
  await expect(header(page)).toContainText("Délices de Bob");
  await expect(page.locator("body")).not.toContainText("Atelier Alice");
});

test("la déconnexion ferme l'accès à l'espace", async ({ page }) => {
  await login(page, SEED.sam);
  await expect(header(page)).toContainText("Employé");
  await page.goto("/dashboard/more");
  await page.getByRole("button", { name: "Se déconnecter" }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard/today");
  await expect(page).toHaveURL(/\/login\?next=/);
});
