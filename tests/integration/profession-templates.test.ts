import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { PROFESSION_TEMPLATES } from "@/features/professions/registry";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Le registre TypeScript et la table `profession_templates` doivent être
 * identiques : une nouvelle version exige une migration (et inversement).
 */
describe.skipIf(!url || !key)("profession_templates (base locale)", () => {
  it("correspond exactement au registre TypeScript", async () => {
    const supabase = createClient(url!, key!, {
      auth: { persistSession: false },
    });
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "alice@exemple.test",
      password: "Motdepasse123",
    });
    expect(authError).toBeNull();

    const { data, error } = await supabase
      .from("profession_templates")
      .select("key, version, label, schema")
      .order("key")
      .order("version");
    expect(error).toBeNull();

    const expected = [...PROFESSION_TEMPLATES]
      .sort((a, b) => a.key.localeCompare(b.key) || a.version - b.version)
      .map((t) => ({
        key: t.key,
        version: t.version,
        label: t.label,
        schema: JSON.parse(JSON.stringify(t)),
      }));
    expect(data).toEqual(expected);
  });
});
