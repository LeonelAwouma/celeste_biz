import { getBusinessContext } from "@/features/businesses/active-business";
import {
  buildExport,
  isExportKind,
  type ExportKind,
} from "@/features/exports/definitions";
import { toCsv } from "@/lib/csv";
import { can } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";
import { todayLocal } from "@/lib/time";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(status: number, message: string) {
  return new Response(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * Export CSV d'une entreprise (propriétaire ou gestionnaire), filtré par
 * période, tracé dans le journal et soumis à un quota.
 */
export async function GET(request: Request) {
  const { business } = await getBusinessContext();
  if (!can(business.role, "exports.run")) {
    return text(403, "Votre rôle ne permet pas d'exporter les données.");
  }
  const params = new URL(request.url).searchParams;
  const kind = params.get("type");
  const from = params.get("du") || null;
  const to = params.get("au") || null;
  if (
    !isExportKind(kind) ||
    (from && !DATE.test(from)) ||
    (to && !DATE.test(to)) ||
    (from && to && from > to)
  ) {
    return text(400, "Paramètres d'export invalides.");
  }

  const result = await buildExport(kind as ExportKind, {
    businessId: business.id,
    professionKey: business.professionKey,
    professionVersion: business.professionVersion,
    from,
    to,
  });

  const supabase = await createClient();
  const { data: allowed, error } = await supabase.rpc("log_export", {
    p_business_id: business.id,
    p_kind: kind,
    p_rows: result.rows.length,
    p_from: from,
    p_to: to,
  });
  if (error) return text(503, "Export impossible pour le moment.");
  if (!allowed) {
    return text(
      429,
      "Trop d'exports en peu de temps : réessayez dans 10 minutes.",
    );
  }

  const period = [from ?? "debut", to ?? todayLocal()].join("_");
  const filename = `celeste-${kind}-${business.slug}-${period}.csv`;
  return new Response(toCsv(result.headers, result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      ...(result.truncated ? { "X-Export-Truncated": "1" } : {}),
    },
  });
}
