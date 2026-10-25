import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Route réservée au suivi client privé (Phase 8). Aucun jeton n'est valide
// pour l'instant : réponse identique quel que soit le jeton (anti-énumération).
export default function TrackingPage() {
  notFound();
}
