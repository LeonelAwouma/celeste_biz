import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

// Tests contre Supabase local (`npm run db:start`), variables de .env.local.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    env: loadEnv("test", process.cwd(), "NEXT_PUBLIC_"),
  },
});
