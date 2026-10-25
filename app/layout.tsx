import type { Metadata, Viewport } from "next";
import "./globals.css";

// Polices système uniquement : aucun téléchargement de police externe,
// pour limiter la consommation de données sur réseaux mobiles.

export const metadata: Metadata = {
  title: "Céleste Biz",
  description:
    "Organisez vos commandes, acomptes, devis et clients, sans obligation de site web.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
