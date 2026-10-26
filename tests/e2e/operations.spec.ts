import { expect, test } from "@playwright/test";

import { SEED, login } from "./helpers";

test("export CSV des commandes : données de l'entreprise, format Excel, journalisé", async ({
  page,
}) => {
  await page.goto("/dashboard/exports");
  await page.getByLabel("Données").selectOption({ label: "Commandes" });
  await page.getByLabel("Du").fill("");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^celeste-orders-atelier-alice-debut_\d{4}-\d{2}-\d{2}\.csv$/,
  );
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.startsWith("﻿")).toBe(true);
  const [header, ...lines] = csv.slice(1).trim().split("\r\n");
  expect(header).toBe(
    '"Numéro";"Client";"État";"Échéance";"Sous-total";"Taxes";"Total";"Encaissé";"Reste à payer";"Créée le";"Clôturée le";"Annulée le"',
  );
  expect(csv).toContain('"Mireille Ngo"');
  expect(csv).toMatch(/"35000,00"/);
  // Aucune donnée de l'entreprise de Bob.
  expect(csv).not.toContain("Délices");
  expect(csv).not.toContain("Traiteur");
  expect(lines.length).toBeGreaterThanOrEqual(3);

  await page.goto("/dashboard/audit");
  await expect(
    page
      .getByRole("list", { name: "Journal" })
      .getByText("Export : créé")
      .first(),
  ).toBeVisible();
});

test("export clients : formule neutralisée", async ({ page }) => {
  const name = `=HYPERLINK("http://exemple.test","Cliquez") ${Date.now()}`;
  await page.goto("/dashboard/customers/new");
  await page.getByLabel("Nom ou surnom").fill(name);
  await page.getByRole("button", { name: "Enregistrer le client" }).click();
  await expect(page.getByText("Client enregistré.")).toBeVisible();

  const response = await page.request.get(
    "/dashboard/exports/telecharger?type=customers",
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("text/csv; charset=utf-8");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const csv = await response.text();
  expect(csv).toContain(`"'=HYPERLINK(""http://exemple.test"",""Cliquez"")`);
  expect(csv).not.toContain(`";"=HYPERLINK`);
});

test("un employé ne peut pas exporter", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await login(page, SEED.sam);
  const response = await page.request.get(
    "/dashboard/exports/telecharger?type=orders",
  );
  expect(response.status()).toBe(403);
  await page.goto("/dashboard/audit");
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await context.close();
});

test("paramètres d'export invalides refusés", async ({ page }) => {
  for (const query of [
    "type=secrets",
    "type=orders&du=hier",
    "type=orders&du=2026-10-10&au=2026-10-01",
  ]) {
    const response = await page.request.get(
      `/dashboard/exports/telecharger?${query}`,
    );
    expect(response.status()).toBe(400);
  }
});

test("sonde de santé et en-têtes de sécurité", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", database: "ok" });
  const home = await request.get("/");
  expect(home.headers()["x-frame-options"]).toBe("DENY");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(home.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
});
