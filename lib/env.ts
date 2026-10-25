import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

/**
 * Configuration publique Supabase, ou `null` si le projet n'est pas encore
 * branché (l'application reste démarrable et l'affiche clairement).
 * Les variables NEXT_PUBLIC_ sont lues littéralement pour être intégrées au
 * build ; aucune clé secrète n'est lue ici.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const parsed = supabaseEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv() !== null;
}

/** URL publique de l'application, utilisée pour les liens envoyés par e-mail. */
export function getAppUrl(): string {
  const parsed = z.url().safeParse(process.env.NEXT_PUBLIC_APP_URL);
  return (parsed.success ? parsed.data : "http://localhost:3000").replace(
    /\/+$/,
    "",
  );
}
