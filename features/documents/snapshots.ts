import { readFiscalProfile } from "@/features/invoices/schemas";

import type { PdfParty, PdfSeller } from "./pdf-models";

const str = (value: unknown) => (typeof value === "string" ? value : null);

/** Vendeur figé à l'émission (`invoices.seller`). */
export function sellerFromSnapshot(
  snapshot: Record<string, unknown> | null,
): PdfSeller {
  return {
    name: str(snapshot?.name) ?? "",
    city: str(snapshot?.city),
    phone: str(snapshot?.phone),
    fiscal: readFiscalProfile(snapshot?.fiscal),
  };
}

/** Acheteur figé à l'émission (`invoices.buyer`), sinon la fiche actuelle. */
export function partyFromSnapshot(
  snapshot: Record<string, unknown> | null,
  fallback: PdfParty,
): PdfParty {
  if (!snapshot) return fallback;
  return {
    name: str(snapshot.name) ?? fallback.name,
    phone: str(snapshot.phone),
    email: str(snapshot.email),
  };
}
