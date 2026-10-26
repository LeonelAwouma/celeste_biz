import { expect, test } from "@playwright/test";

const ORDERS: Record<string, string> = {
  "mobile-360": "0da00000-0000-4000-8000-000000000002",
  desktop: "0da00000-0000-4000-8000-000000000003",
};
const HUMAN =
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

test("campagne : lien court vers WhatsApp, clics comptés, provenance, archivage", async ({
  page,
}, testInfo) => {
  const suffix = Date.now().toString(36).toUpperCase();
  const label = `Promo ${suffix}`;
  const code = `PROMO-${suffix}`;

  await page.goto("/dashboard/campaigns/new");
  await page.getByLabel("Nom de la campagne").fill(label);
  await expect(page.getByLabel("Code de référence")).toHaveValue(code);
  await page
    .getByLabel("Article concerné (facultatif)")
    .selectOption({ label: "Robe sur mesure" });
  await expect(page.getByLabel("Message prérempli")).toHaveValue(
    /« Robe sur mesure »/,
  );
  await expect(page.getByTestId("campaign-message-preview")).toContainText(
    `Réf. ${code}`,
  );
  await page.getByRole("button", { name: "Créer le lien" }).click();
  await expect(page.getByText("Lien créé.")).toBeVisible();
  const link = (await page.getByTestId("campaign-link").textContent())!.trim();
  expect(link).toMatch(/\/c\/[A-Za-z0-9_-]{12}$/);

  // Le lien ouvre WhatsApp sur le numéro de l'entreprise, avec la référence.
  const opened = await page.request.get(link, {
    maxRedirects: 0,
    headers: { "user-agent": HUMAN },
  });
  expect(opened.status()).toBe(302);
  const location = new URL(opened.headers()["location"]);
  expect(location.origin + location.pathname).toBe(
    "https://wa.me/237690000001",
  );
  expect(location.searchParams.get("text")).toBe(
    `Bonjour, je suis intéressé(e) par « Robe sur mesure ». Est-ce disponible ?\n\nRéf. ${code}`,
  );
  expect(opened.headers()["cache-control"]).toContain("no-store");

  // Aperçu automatique (robot WhatsApp) : redirigé mais non compté.
  const bot = await page.request.get(link, {
    maxRedirects: 0,
    headers: { "user-agent": "WhatsApp/2.24.1 A" },
  });
  expect(bot.status()).toBe(302);
  await page.reload();
  await expect(page.getByTestId("campaign-clicks")).toHaveText("1");

  // Provenance déclarée sur une commande.
  const orderId = ORDERS[testInfo.project.name];
  await page.goto(`/dashboard/orders/${orderId}`);
  await page
    .getByLabel("Campagne (référence « Réf. » du message)")
    .selectOption({ label: `${code} — ${label}` });
  await page.getByRole("button", { name: "Enregistrer la provenance" }).click();
  await expect(page.getByText("Provenance enregistrée.")).toBeVisible();
  await page.goto("/dashboard/campaigns");
  await page.getByRole("link", { name: new RegExp(label) }).click();
  await expect(page.getByTestId("campaign-orders")).toHaveText("1");

  // Archivage : le lien n'ouvre plus WhatsApp.
  await page.getByRole("checkbox", { name: /Archiver la campagne/ }).check();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText(/Campagne archivée/)).toBeVisible();
  const archived = await page.request.get(link, { maxRedirects: 0 });
  expect(archived.status()).toBe(410);
  expect(await archived.text()).toContain("Lien indisponible");

  // Retire la provenance pour laisser la commande dans son état initial.
  await page.goto(`/dashboard/orders/${orderId}`);
  await page
    .getByLabel("Campagne (référence « Réf. » du message)")
    .selectOption("");
  await page.getByRole("button", { name: "Enregistrer la provenance" }).click();
  await expect(page.getByText("Provenance enregistrée.")).toBeVisible();
});

test("lien de démonstration et lien inconnu", async ({ request }) => {
  const demo = await request.get("/c/demoRobeWax1", {
    maxRedirects: 0,
    headers: { "user-agent": "facebookexternalhit/1.1" },
  });
  expect(demo.status()).toBe(302);
  expect(demo.headers()["location"]).toMatch(
    /^https:\/\/wa\.me\/237690000001\?text=.*R%C3%A9f\.%20ROBE-WAX$/,
  );
  const unknown = await request.get("/c/inconnu12345", { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
});

test("écrire au client sur WhatsApp depuis sa commande", async ({ page }) => {
  await page.goto("/dashboard/orders/0da00000-0000-4000-8000-000000000001");
  await expect(
    page.getByRole("link", { name: /Écrire à Mireille Ngo sur WhatsApp/ }),
  ).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/237\d+\?text=Bonjour%20Mireille/,
  );
});
