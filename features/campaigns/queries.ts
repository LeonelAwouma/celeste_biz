import "server-only";

import { toAmount } from "@/features/orders/queries";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayLocal } from "@/lib/time";

import { isCampaignSource, type CampaignSource } from "./schemas";

export type CampaignSummary = {
  id: string;
  publicId: string;
  code: string;
  label: string;
  source: CampaignSource;
  catalogItemId: string | null;
  message: string;
  archivedAt: string | null;
  createdAt: string;
  clickCount: number;
  clicks7d: number;
  lastClickAt: string | null;
  ordersCount: number;
  ordersTotal: string;
};

type Row = {
  id: string;
  public_id: string;
  code: string;
  label: string;
  source: string;
  catalog_item_id: string | null;
  message: string;
  archived_at: string | null;
  created_at: string;
  click_count: number;
  clicks_7d: number;
  last_click_at: string | null;
  orders_count: number;
  orders_total: number | string;
};

function toSummary(row: Row): CampaignSummary {
  return {
    id: row.id,
    publicId: row.public_id,
    code: row.code,
    label: row.label,
    source: isCampaignSource(row.source) ? row.source : "other",
    catalogItemId: row.catalog_item_id,
    message: row.message,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    clickCount: Number(row.click_count),
    clicks7d: Number(row.clicks_7d),
    lastClickAt: row.last_click_at,
    ordersCount: Number(row.orders_count),
    ordersTotal: toAmount(row.orders_total),
  };
}

export async function listCampaigns(
  businessId: string,
  archived = false,
): Promise<CampaignSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_campaigns", {
    p_business_id: businessId,
    p_archived: archived,
  });
  if (error) throw new Error("Impossible de charger les campagnes.");
  return ((data ?? []) as Row[]).map(toSummary);
}

export async function getCampaign(
  businessId: string,
  id: string,
): Promise<CampaignSummary | null> {
  const [active, archived] = await Promise.all([
    listCampaigns(businessId, false),
    listCampaigns(businessId, true),
  ]);
  return [...active, ...archived].find((c) => c.id === id) ?? null;
}

export type DailyClicks = { day: string; clicks: number };

/** Clics des 14 derniers jours (jours sans clic inclus, à zéro). */
export async function getDailyClicks(
  businessId: string,
  campaignId: string,
): Promise<DailyClicks[]> {
  const today = todayLocal();
  const from = addDays(today, -13);
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaign_clicks_daily")
    .select("day, clicks")
    .eq("business_id", businessId)
    .eq("campaign_id", campaignId)
    .gte("day", from);
  const byDay = new Map((data ?? []).map((row) => [row.day, row.clicks]));
  return Array.from({ length: 14 }, (_, index) => {
    const day = addDays(from, index);
    return { day, clicks: Number(byDay.get(day) ?? 0) };
  });
}

/** Provenance déclarée d'une commande. */
export async function getOrderCampaignId(
  businessId: string,
  orderId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_campaigns")
    .select("campaign_id")
    .eq("business_id", businessId)
    .eq("order_id", orderId)
    .maybeSingle();
  return data?.campaign_id ?? null;
}
