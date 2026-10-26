import { isPreviewBot } from "@/features/campaigns/schemas";
import { createAnonClient } from "@/lib/supabase/anon";
import { whatsappLink } from "@/lib/whatsapp";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}

function page(status: number, title: string, text: string) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(title)}</title></head><body style="font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#111827"><h1 style="font-size:1.5rem">${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p></body></html>`;
  return new Response(html, {
    status,
    headers: { ...HEADERS, "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Lien de campagne : redirige vers WhatsApp (`wa.me`) avec le message
 * prérempli et la référence. Seul un compteur de clics par jour est mis à
 * jour (robots d'aperçu exclus) : rien n'identifie le visiteur.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/c/[id]">,
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{12}$/.test(id)) {
    return page(404, "Lien introuvable", "Vérifiez l'adresse du lien.");
  }
  const { data, error } = await createAnonClient().rpc("open_campaign_link", {
    p_public_id: id,
    p_count: !isPreviewBot(request.headers.get("user-agent")),
  });
  if (error) {
    return page(
      503,
      "Lien momentanément indisponible",
      "Réessayez dans un instant.",
    );
  }
  const result = data as {
    state?: string;
    business_name?: string;
    phone?: string;
    text?: string;
  } | null;
  if (!result) {
    return page(404, "Lien introuvable", "Vérifiez l'adresse du lien.");
  }
  if (result.state !== "ok" || !result.phone || !result.text) {
    return page(
      410,
      "Lien indisponible",
      `Cette offre n'est plus active. Contactez ${result.business_name ?? "le commerce"} directement.`,
    );
  }
  return new Response(null, {
    status: 302,
    headers: { ...HEADERS, Location: whatsappLink(result.phone, result.text) },
  });
}
