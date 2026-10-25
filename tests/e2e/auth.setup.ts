import { expect, test as setup } from "@playwright/test";

import { ALICE_STATE } from "../../playwright.config";
import { SEED, login } from "./helpers";

setup("connexion d'Alice (seed)", async ({ page }) => {
  await login(page, SEED.alice);
  await expect(page).toHaveURL(/\/dashboard\/today$/);
  await page.context().storageState({ path: ALICE_STATE });
});
