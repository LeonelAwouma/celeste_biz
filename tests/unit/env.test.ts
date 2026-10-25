import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppUrl, getSupabaseEnv } from "@/lib/env";

afterEach(() => vi.unstubAllEnvs());

describe("configuration", () => {
  it("considère Supabase non branché sans variables", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(getSupabaseEnv()).toBeNull();
  });

  it("lit l'URL et la clé publique", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_xxxxxxxxxxxxxxxx",
    );
    expect(getSupabaseEnv()?.url).toBe("http://127.0.0.1:54321");
  });

  it("retire la barre finale de l'URL de l'application", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.exemple.test/");
    expect(getAppUrl()).toBe("https://app.exemple.test");
  });
});
