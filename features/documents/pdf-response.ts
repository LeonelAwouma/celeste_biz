import "server-only";

import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

/** Réponse PDF privée (jamais mise en cache partagé). */
export function pdfResponse(bytes: Uint8Array, filename: string): Response {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "-");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function notFoundResponse(): Response {
  return new Response("Document introuvable.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Pièce émise : le premier PDF généré est archivé dans le bucket privé
 * `documents` avec son empreinte, puis toujours resservi à l'identique.
 * Sans droit d'archivage (employé, lecteur) ou en cas d'échec, le PDF est
 * régénéré depuis les instantanés figés de la pièce.
 */
export async function archivedPdf(options: {
  kind: "invoice" | "credit_note";
  id: string;
  businessId: string;
  existingPath: string | null;
  path: string;
  canArchive: boolean;
  render: () => Promise<Uint8Array>;
}): Promise<Uint8Array> {
  const supabase = await createClient();
  const bucket = supabase.storage.from("documents");

  if (options.existingPath) {
    const { data } = await bucket.download(options.existingPath);
    if (data) return new Uint8Array(await data.arrayBuffer());
  }

  const bytes = await options.render();
  if (!options.canArchive || options.existingPath) return bytes;

  const path = `${options.businessId}/${options.path}`;
  const { error } = await bucket.upload(
    path,
    // Type porté par le Blob : sinon le stockage le voit comme octet-stream.
    new Blob([new Uint8Array(bytes)], { type: "application/pdf" }),
    {
      contentType: "application/pdf",
      upsert: false,
    },
  );
  if (error) {
    // Archivé entre-temps par une autre requête : on sert la version stockée.
    const { data } = await bucket.download(path);
    if (data) return new Uint8Array(await data.arrayBuffer());
    return bytes;
  }
  await supabase.rpc("attach_document_pdf", {
    p_kind: options.kind,
    p_id: options.id,
    p_path: path,
    p_sha256: sha256Hex(bytes),
  });
  return bytes;
}
