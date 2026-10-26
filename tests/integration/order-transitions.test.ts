import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { ORDER_TRANSITIONS } from "@/features/orders/status";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Les boutons affichés doivent correspondre aux transitions validées en base. */
describe.skipIf(!url || !key)("order_status_transitions (base locale)", () => {
  it("correspond exactement à ORDER_TRANSITIONS", async () => {
    const supabase = createClient(url!, key!, {
      auth: { persistSession: false },
    });
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: "alice@exemple.test",
      password: "Motdepasse123",
    });
    expect(authError).toBeNull();

    const { data, error } = await supabase
      .from("order_status_transitions")
      .select("from_status, to_status, roles");
    expect(error).toBeNull();

    const normalize = (
      rows: { from: string; to: string; roles: readonly string[] }[],
    ) =>
      rows
        .map(
          (row) => `${row.from}>${row.to}:${[...row.roles].sort().join(",")}`,
        )
        .sort();
    expect(
      normalize(
        (data ?? []).map((row) => ({
          from: row.from_status,
          to: row.to_status,
          roles: row.roles,
        })),
      ),
    ).toEqual(
      normalize(
        ORDER_TRANSITIONS.map(([from, to, roles]) => ({ from, to, roles })),
      ),
    );
  });
});
