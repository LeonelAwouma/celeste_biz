import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

import { SupabaseNotConfiguredError } from "./server";

/**
 * Client anonyme sans cookies ni session : pour les pages publiques mises en
 * cache (aucune donnée propre au visiteur). Soumis aux droits du rôle `anon`.
 */
export function createAnonClient() {
  const env = getSupabaseEnv();
  if (!env) throw new SupabaseNotConfiguredError();
  return createClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
