import { notFound } from "next/navigation";

// Route réservée aux sites publics facultatifs (Phase 9). Tant qu'aucun site
// n'est publié, elle ne révèle rien (pas d'énumération des entreprises).
export default function PublicSitePage() {
  notFound();
}
