import "server-only";

import { createClient } from "@/lib/supabase/server";

export const QUOTA_MESSAGES = {
  upload:
    "Trop d'envois de photos en peu de temps : réessayez dans 10 minutes.",
} as const;

/** Consomme une unité de quota de l'entreprise ; false si la limite est atteinte. */
export async function consumeQuota(
  businessId: string,
  kind: keyof typeof QUOTA_MESSAGES,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_quota", {
    p_business_id: businessId,
    p_kind: kind,
  });
  return !error && data === true;
}
