import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";

import { OfflineBanner } from "@/components/feedback/offline-banner";
import { LoadingState } from "@/components/feedback/loading-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { BusinessSwitcher } from "./business-switcher";
import { DashboardGate } from "./dashboard-gate";
import { BottomTabNav, SidebarNav } from "./nav-links";
import { SignOutButton } from "./sign-out-button";
import { NEW_ORDER_HREF } from "./navigation";

/**
 * Coquille de l'espace commerçant : en-tête, navigation (barre latérale sur
 * grand écran, onglets en bas sur mobile) et bouton « Nouvelle commande »
 * toujours accessible.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-20 border-b bg-card">
        <OfflineBanner />
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/dashboard/today" className="font-bold text-primary">
            Céleste Biz
          </Link>
          {/* Lit la session : rendu à la demande, derrière une frontière. */}
          <Suspense fallback={<Skeleton className="h-5 w-32" />}>
            <BusinessSwitcher />
          </Suspense>
          <Button asChild className="ml-auto hidden md:inline-flex">
            <Link href={NEW_ORDER_HREF}>
              <Plus aria-hidden="true" />
              Nouvelle commande
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r p-3 md:block">
          <SidebarNav />
          <hr className="my-2" />
          <SignOutButton className="w-full justify-start text-muted-foreground" />
        </aside>
        <main
          id="contenu"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 pt-4 pb-36 md:px-8 md:pb-10"
        >
          <Suspense fallback={<LoadingState />}>
            <DashboardGate>{children}</DashboardGate>
          </Suspense>
        </main>
      </div>

      <Button
        asChild
        size="lg"
        className="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-full shadow-lg md:hidden"
      >
        <Link href={NEW_ORDER_HREF}>
          <Plus aria-hidden="true" />
          Nouvelle commande
        </Link>
      </Button>

      <BottomTabNav />
    </div>
  );
}
