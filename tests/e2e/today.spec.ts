import { expect, test } from "@playwright/test";

import { SEED, login } from "./helpers";

test("alertes expliquées et reliées aux vrais dossiers", async ({ page }) => {
  await page.goto("/dashboard/today");
  const main = page.getByRole("main");

  const late = main.getByTestId("alert-late");
  await expect(late.getByRole("heading")).toHaveText(
    /^\d+ commandes? en retard$/,
  );
  await expect(late).toContainText("Échéance dépassée");
  const lateOrder = late.getByRole("link", {
    name: /CMD-\d{4}-0002 · Paul Etoga/,
  });
  await expect(lateOrder).toBeVisible();

  const soon = main.getByTestId("alert-due_soon");
  await expect(soon.getByRole("heading")).toHaveText(
    /^\d+ commandes? à remettre sous 48 h$/,
  );
  await expect(
    soon.getByRole("link", { name: /Mireille Ngo/ }).first(),
  ).toBeVisible();

  await expect(main.getByTestId("alert-to_collect")).toContainText(
    "Reste à payer",
  );
  await expect(main.getByTestId("alert-quotes_waiting")).toContainText(
    "sans acceptation ni refus",
  );
  // Équipe de deux personnes : les commandes sans responsable sont signalées.
  await expect(main.getByTestId("alert-unassigned")).toBeVisible();

  await expect(main.getByTestId("kpi-active")).toHaveText(/^\d+$/);
  await expect(main.getByTestId("kpi-month")).toHaveText(/FCFA$/);
  await expect(main).toContainText("Aucun bénéfice n'est estimé");

  await lateOrder.click();
  await expect(page).toHaveURL(
    /\/dashboard\/orders\/0da00000-0000-4000-8000-000000000002$/,
  );
});

test("« Tout voir » ouvre la liste filtrée correspondante", async ({
  page,
}) => {
  await page.goto("/dashboard/today");
  await page
    .getByTestId("alert-due_soon")
    .getByRole("link", { name: /Toutes les commandes sous 48 h/ })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/orders\?filtre=soon$/);
  await expect(page.getByRole("link", { name: "Sous 48 h" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("list", { name: "Liste des commandes" }),
  ).toContainText("Mireille Ngo");
});

test.describe("autre entreprise", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Bob ne voit que ses propres dossiers", async ({ page }) => {
    await login(page, SEED.bob);
    await page.goto("/dashboard/today");
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { name: "En chiffres" }),
    ).toBeVisible();
    await expect(main).not.toContainText("Mireille Ngo");
    await expect(main).not.toContainText("Paul Etoga");
    // Bob travaille seul : pas d'alerte « sans responsable ».
    await expect(main.getByTestId("alert-unassigned")).toHaveCount(0);
  });
});
