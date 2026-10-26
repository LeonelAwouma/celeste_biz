import "server-only";

import { z } from "zod";

import { decodeCursor, encodeCursor } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export type Customer = {
  id: string;
  name: string;
  phone_e164: string | null;
  email: string | null;
  notes: string | null;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  archived_at: string | null;
  created_at: string;
};

const PAGE_SIZE = 20;
const COLUMNS =
  "id, name, phone_e164, email, notes, marketing_consent, marketing_consent_at, archived_at, created_at";

/**
 * Recherche paginée (par nom puis identifiant). Le filtrage par entreprise
 * est garanti par la RLS ; `businessId` vient de l'adhésion vérifiée.
 */
export async function searchCustomers(
  businessId: string,
  options: { query?: string; archived?: boolean; cursor?: string },
): Promise<{ customers: Customer[]; nextCursor: string | null }> {
  const after = decodeCursor(options.cursor, ["n", "i"] as const);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_customers", {
    p_business_id: businessId,
    p_query: options.query?.slice(0, 100) || null,
    p_archived: options.archived ?? false,
    p_after_name: after?.n ?? null,
    p_after_id: after && z.uuid().safeParse(after.i).success ? after.i : null,
    p_limit: PAGE_SIZE + 1,
  });
  if (error) throw new Error("Impossible de charger les clients.");

  const rows = (data ?? []) as (Customer & { name_search: string })[];
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    customers: page,
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? encodeCursor({ n: last.name_search, i: last.id })
        : null,
  };
}

export async function getCustomer(
  businessId: string,
  id: string,
): Promise<Customer | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(COLUMNS)
    .eq("business_id", businessId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** Clients actifs ayant déjà ce numéro (alerte de doublon). */
export async function findCustomersByPhone(
  businessId: string,
  phone: string,
  excludeId: string,
): Promise<Pick<Customer, "id" | "name">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("phone_e164", phone)
    .is("archived_at", null)
    .neq("id", excludeId)
    .limit(3);
  return data ?? [];
}
