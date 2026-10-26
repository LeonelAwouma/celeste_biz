import { expect, test } from "@playwright/test";

// Chaque projet travaille sur sa propre commande : créer un lien révoque le
// précédent, deux projets en parallèle ne doivent pas se gêner.
const ORDERS = {
  "mobile-360": "0da00000-0000-4000-8000-000000000001",
  desktop: "0da00000-0000-4000-8000-000000000003",
} as Record<string, string>;

test("lien de suivi : création, consultation sans compte, reçu, révocation", async ({
  page,
  browser,
}, testInfo) => {
  const orderId = ORDERS[testInfo.project.name];
  test.skip(!orderId, "projet sans commande dédiée");

  await page.goto(`/dashboard/orders/${orderId}`);
  const section = page.getByRole("region", { name: "Suivi client" });
  await section
    .getByRole("button", { name: /Créer (le|un nouveau) lien/ })
    .click();
  const linkBox = section.getByTestId("tracking-link");
  await expect(linkBox).toHaveText(/\/suivi\/[A-Za-z0-9_-]{43}$/);
  const link = (await linkBox.textContent())!.trim();
  await expect(section.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/\d+\?text=.*suivi/,
  );

  // Client du commerçant : aucune session, aucun compte.
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 360, height: 740 },
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
  });
  const customer = await context.newPage();
  const response = await customer.goto(link);
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(
    customer.getByRole("heading", { level: 1, name: /^Commande CMD-/ }),
  ).toBeVisible();
  await expect(customer.getByTestId("tracking-status")).not.toBeEmpty();
  await expect(customer.getByTestId("tracking-balance")).toHaveText(/FCFA$/);
  await expect(customer.getByText("Dernière mise à jour")).toBeVisible();
  // Jamais les notes internes ni les détails de fabrication.
  await expect(customer.locator("body")).not.toContainText("Tissu déposé");
  await expect(customer.locator("body")).not.toContainText("Robe longue");
  const overflow = await customer.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);

  const receipt = customer.getByRole("link", { name: /^Reçu de / }).first();
  const href = await receipt.getAttribute("href");
  const pdf = await customer.request.get(href!);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect(pdf.headers()["cache-control"]).toContain("no-store");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // Le commerçant voit la consultation puis révoque le lien.
  await page.reload();
  await expect(section.getByTestId("tracking-active")).toContainText(
    /Consulté \d+ fois/,
  );
  await section.getByRole("button", { name: "Révoquer le lien" }).click();
  await expect(
    section.getByRole("button", { name: "Créer le lien de suivi" }),
  ).toBeVisible();

  await customer.reload();
  await expect(
    customer.getByRole("heading", { name: "Lien désactivé" }),
  ).toBeVisible();
  await expect(customer.locator("body")).not.toContainText("CMD-");
  expect((await customer.request.get(href!)).status()).toBe(404);
  await context.close();
});
