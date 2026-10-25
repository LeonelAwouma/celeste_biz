import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase n'est pas configuré (voir .env.example).");
  }
}

/**
 * Client Supabase côté serveur, agissant avec la session de l'utilisateur :
 * toutes les requêtes sont soumises à la RLS.
 */
export async function createClient() {
  // Session = donnée de requête : jamais prérendue (le client lit l'horloge).
  const cookieStore = await cookies();
  await connection();

  const env = getSupabaseEnv();
  if (!env) throw new SupabaseNotConfiguredError();

  return createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Appel depuis un Server Component : le proxy rafraîchit la session.
        }
      },
    },
  });
}
