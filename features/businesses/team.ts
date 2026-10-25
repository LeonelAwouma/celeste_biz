import "server-only";

import { isBusinessRole, type BusinessRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

export type TeamMember = {
  userId: string;
  displayName: string;
  email: string | null;
  role: BusinessRole;
  isCurrentUser: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: BusinessRole;
  expiresAt: string;
};

/** Membres actifs (adresses visibles du propriétaire seulement, côté base). */
export async function listMembers(businessId: string): Promise<TeamMember[]> {
  const supabase = await createClient();
  const [{ data: claims }, { data, error }] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.rpc("list_business_members", { p_business_id: businessId }),
  ]);
  if (error) throw new Error("Impossible de charger l'équipe.");

  const me = claims?.claims?.sub;
  return (
    (data ?? []) as {
      user_id: string;
      display_name: string;
      email: string | null;
      role: string;
    }[]
  ).flatMap((row) =>
    isBusinessRole(row.role)
      ? [
          {
            userId: row.user_id,
            displayName: row.display_name,
            email: row.email,
            role: row.role,
            isCurrentUser: row.user_id === me,
          },
        ]
      : [],
  );
}

/** Invitations en attente (lisibles par le propriétaire, filtrées par RLS). */
export async function listPendingInvitations(
  businessId: string,
): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_invitations")
    .select("id, email, role, expires_at")
    .eq("business_id", businessId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw new Error("Impossible de charger les invitations.");

  return (data ?? []).flatMap((row) =>
    isBusinessRole(row.role)
      ? [
          {
            id: row.id,
            email: row.email,
            role: row.role,
            expiresAt: row.expires_at,
          },
        ]
      : [],
  );
}
