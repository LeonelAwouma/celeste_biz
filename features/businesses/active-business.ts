import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  resolveModules,
  sanitizeModuleOverrides,
  type ModuleOverrides,
} from "@/features/professions/modules";
import { getProfessionTemplate } from "@/features/professions/registry";
import type {
  ModuleKey,
  ProfessionTemplate,
} from "@/features/professions/schema";
import { requireUser } from "@/lib/auth/session";
import { isBusinessRole, type BusinessRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

/** Cookie de préférence : il ne donne aucun droit, l'adhésion est revérifiée. */
export const ACTIVE_BUSINESS_COOKIE = "cb_active_business";

export type BusinessMembership = {
  id: string;
  name: string;
  slug: string;
  professionKey: string;
  professionVersion: number;
  city: string | null;
  whatsappPhone: string | null;
  role: BusinessRole;
};

export type BusinessContext = {
  business: BusinessMembership;
  template: ProfessionTemplate;
  moduleOverrides: ModuleOverrides;
  modules: Set<ModuleKey>;
};

/** Entreprises dont l'utilisateur est membre actif (filtrées par la RLS). */
export const listMyBusinesses = cache(
  async (): Promise<BusinessMembership[]> => {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("business_members")
      .select(
        "role, businesses!inner(id, name, slug, profession_key, profession_version, city, whatsapp_phone_e164)",
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });

    if (error) throw new Error("Impossible de charger vos entreprises.");

    return (data ?? []).flatMap((row) => {
      const business = Array.isArray(row.businesses)
        ? row.businesses[0]
        : row.businesses;
      if (!business || !isBusinessRole(row.role)) return [];
      return [
        {
          id: business.id,
          name: business.name,
          slug: business.slug,
          professionKey: business.profession_key,
          professionVersion: business.profession_version,
          city: business.city,
          whatsappPhone: business.whatsapp_phone_e164,
          role: row.role,
        },
      ];
    });
  },
);

/**
 * Entreprise active : celle du cookie si l'utilisateur en est toujours
 * membre, sinon la première. `null` si l'utilisateur n'en a aucune.
 */
export const getActiveBusiness = cache(
  async (): Promise<BusinessMembership | null> => {
    const businesses = await listMyBusinesses();
    const preferred = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
    return (
      businesses.find((business) => business.id === preferred) ??
      businesses[0] ??
      null
    );
  },
);

export async function requireActiveBusiness(): Promise<BusinessMembership> {
  const business = await getActiveBusiness();
  if (!business) redirect("/onboarding");
  return business;
}

/** Entreprise active + profil métier + modules actifs. */
export const getBusinessContext = cache(async (): Promise<BusinessContext> => {
  const business = await requireActiveBusiness();
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_settings")
    .select("modules")
    .eq("business_id", business.id)
    .maybeSingle();

  const template = getProfessionTemplate(
    business.professionKey,
    business.professionVersion,
  );
  const moduleOverrides = sanitizeModuleOverrides(data?.modules);
  return {
    business,
    template,
    moduleOverrides,
    modules: resolveModules(template, moduleOverrides),
  };
});
