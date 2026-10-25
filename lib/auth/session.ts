import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Utilisateur authentifié de la requête, vérifié par Supabase (JWT validé),
 * ou `null`. Mémorisé pour la durée d'un rendu.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return null;
  const email = data?.claims?.email;
  return { id: sub, email: typeof email === "string" ? email : null };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
