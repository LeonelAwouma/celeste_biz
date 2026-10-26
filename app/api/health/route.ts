import { connection } from "next/server";

import { createAnonClient } from "@/lib/supabase/anon";

/**
 * Sonde de disponibilité pour la supervision (Vercel, UptimeRobot…) :
 * application et base de données, sans aucune donnée.
 */
export async function GET() {
  await connection();
  const started = Date.now();
  let database = false;
  try {
    const { data, error } = await createAnonClient().rpc("health_check");
    database = !error && data === true;
  } catch {
    database = false;
  }
  return Response.json(
    {
      status: database ? "ok" : "degraded",
      database: database ? "ok" : "unreachable",
      latencyMs: Date.now() - started,
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
