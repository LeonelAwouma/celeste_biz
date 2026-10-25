import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
export const ALICE_STATE = "playwright/.auth/alice.json";

/**
 * Prérequis : Supabase local démarré (`npx supabase start`) et `.env.local`
 * renseigné (voir README). Les e-mails sont lus dans Mailpit.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      // Smartphone Android d'entrée de gamme : écran de 360 px de large.
      name: "mobile-360",
      dependencies: ["setup"],
      use: {
        ...devices["Galaxy S9+"],
        viewport: { width: 360, height: 740 },
        storageState: ALICE_STATE,
      },
    },
    {
      name: "desktop",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: ALICE_STATE },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}` },
  },
});
