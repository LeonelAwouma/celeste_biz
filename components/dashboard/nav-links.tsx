"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";

import {
  MOBILE_TAB_NAV,
  PRIMARY_NAV,
  SECONDARY_NAV,
  isActive,
  type NavItem,
} from "./navigation";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span>{item.label}</span>
      {item.hint ? (
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {item.hint}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Le chemin n'est connu qu'à l'exécution sur les routes dynamiques
 * (`/clients/[id]`) : la navigation est d'abord rendue sans onglet actif,
 * puis complétée derrière une frontière Suspense.
 */
function withPathname(Nav: (props: { pathname: string }) => React.ReactNode) {
  function NavWithPathname() {
    return <Nav pathname={usePathname()} />;
  }
  return function NavBoundary() {
    return (
      <Suspense fallback={<Nav pathname="" />}>
        <NavWithPathname />
      </Suspense>
    );
  };
}

function SidebarNavItems({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-1">
      {PRIMARY_NAV.map((item) => (
        <SidebarLink key={item.href} item={item} pathname={pathname} />
      ))}
      <hr className="my-2" />
      {SECONDARY_NAV.map((item) => (
        <SidebarLink key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}

function BottomTabNavItems({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_TAB_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 text-[11px] leading-tight font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Barre latérale (écrans ≥ md). */
export const SidebarNav = withPathname(SidebarNavItems);

/** Barre d'onglets fixée en bas (mobile). */
export const BottomTabNav = withPathname(BottomTabNavItems);
