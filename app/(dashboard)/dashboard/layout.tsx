import type { Metadata } from "next";

import { AppShell } from "@/components/dashboard/app-shell";

export const metadata: Metadata = {
  title: { template: "%s · Céleste Biz", default: "Céleste Biz" },
  robots: { index: false, follow: false },
};

// L'accès sera protégé par l'authentification Supabase en Phase 2.
export default function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  return <AppShell>{children}</AppShell>;
}
