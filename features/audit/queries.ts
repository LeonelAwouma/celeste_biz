import "server-only";

import { createClient } from "@/lib/supabase/server";

export type AuditEntry = {
  id: number;
  action: string;
  actorId: string | null;
  entity: string;
  metadata: Record<string, unknown>;
  at: string;
};

const PAGE_SIZE = 50;

/** Journal de l'entreprise, du plus récent au plus ancien (RLS : gérants). */
export async function listAuditLogs(
  businessId: string,
  before?: number,
): Promise<{ entries: AuditEntry[]; nextCursor: number | null }> {
  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, action, actor_id, entity, metadata, at")
    .eq("business_id", businessId)
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);
  if (before) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) throw new Error("Impossible de charger le journal.");
  const rows = data ?? [];
  const entries = rows.slice(0, PAGE_SIZE).map((row) => ({
    id: Number(row.id),
    action: row.action,
    actorId: row.actor_id,
    entity: row.entity,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    at: row.at,
  }));
  return {
    entries,
    nextCursor: rows.length > PAGE_SIZE ? entries[entries.length - 1].id : null,
  };
}
