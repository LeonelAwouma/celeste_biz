import { expect, type Page } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const SEED_PASSWORD = "Motdepasse123";
export const SEED = {
  alice: "alice@exemple.test",
  sam: "sam@exemple.test",
  bob: "bob@exemple.test",
  businessA: "aaaaaaaa-0000-4000-8000-000000000001",
} as const;

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.test`;
}

/** Connexion ; attend la sortie de /login sauf si un échec est attendu. */
export async function login(
  page: Page,
  email: string,
  password = SEED_PASSWORD,
  { expectFailure = false } = {},
) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  if (!expectFailure) await page.waitForURL((url) => url.pathname !== "/login");
}

/** Dernier lien `/auth/confirm` reçu par cette adresse (Mailpit). */
export async function latestAuthLink(email: string, subject: RegExp) {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`,
        ).then((r) => r.json());
        const message = (
          search.messages as { ID: string; Subject: string }[]
        ).find((m) => subject.test(m.Subject));
        if (!message) return undefined;
        const detail = await fetch(
          `${MAILPIT_URL}/api/v1/message/${message.ID}`,
        ).then((r) => r.json());
        link = /href="([^"]*\/auth\/confirm\?[^"]+)"/
          .exec(detail.HTML as string)?.[1]
          ?.replaceAll("&amp;", "&");
        return link;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

/** Inscrit puis confirme un nouveau compte ; la session est ouverte. */
export async function signUpAndConfirm(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/signup");
  await page.getByLabel("Votre nom").fill("Test Pilote");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByText(/Ouvrez le lien envoyé/)).toBeVisible();

  await page.goto(await latestAuthLink(email, /Confirmez/));
  await expect(page).toHaveURL(/\/onboarding$/);
}

export async function createBusiness(
  page: Page,
  name: string,
  profession: RegExp = /Autre activité/,
) {
  await page.goto("/onboarding");
  await page.getByLabel("Nom commercial").fill(name);
  await page.getByRole("radio", { name: profession }).check();
  await page.getByRole("button", { name: "Créer mon entreprise" }).click();
  await expect(page).toHaveURL(/\/dashboard\/today$/);
}

/** Valide les boîtes de confirmation natives (actions critiques). */
export function acceptDialogs(page: Page) {
  page.on("dialog", (dialog) => void dialog.accept());
}
