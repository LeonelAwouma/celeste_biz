import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { isTokenShape, parseTrackingView, type TrackingView } from "./view";

/**
 * Clé client pour la limitation des tentatives : condensat de l'adresse IP
 * (jamais stockée en clair).
 */
export async function clientKey(): Promise<string> {
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip") ||
    "inconnue";
  return createHash("sha256").update(`suivi:${ip}`).digest("hex").slice(0, 32);
}

export async function getTrackingView(token: string): Promise<TrackingView> {
  if (!isTokenShape(token)) return { state: "not_found" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_tracking_view", {
    p_token: token,
    p_client_key: await clientKey(),
  });
  if (error) throw new Error("Suivi momentanément indisponible.");
  return parseTrackingView(data);
}

export async function getTrackingDocument(
  token: string,
  kind: "receipt" | "invoice",
  id: string,
): Promise<Record<string, unknown> | null> {
  if (!isTokenShape(token) || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_tracking_document", {
    p_token: token,
    p_kind: kind,
    p_id: id,
    p_client_key: await clientKey(),
  });
  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : null;
}

export type TrackingLinkInfo = {
  id: string;
  createdAt: string;
  expiresAt: string;
  showAmounts: boolean;
  showDocuments: boolean;
  viewCount: number;
  lastViewedAt: string | null;
};

/** Lien actif d'une commande (côté commerçant ; le jeton n'est pas lisible). */
export async function getActiveTrackingLink(
  businessId: string,
  orderId: string,
): Promise<TrackingLinkInfo | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tracking_links")
    .select(
      "id, created_at, expires_at, show_amounts, show_documents, view_count, last_viewed_at",
    )
    .eq("business_id", businessId)
    .eq("order_id", orderId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
    showAmounts: data.show_amounts,
    showDocuments: data.show_documents,
    viewCount: data.view_count,
    lastViewedAt: data.last_viewed_at,
  };
}
