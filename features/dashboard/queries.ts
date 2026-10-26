import "server-only";

import { createClient } from "@/lib/supabase/server";

import { parseDashboardSummary, type DashboardSummary } from "./summary";

export async function getDashboardSummary(
  businessId: string,
): Promise<DashboardSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_summary", {
    p_business_id: businessId,
  });
  if (error) throw new Error("Impossible de charger le tableau de bord.");
  return parseDashboardSummary(data);
}
