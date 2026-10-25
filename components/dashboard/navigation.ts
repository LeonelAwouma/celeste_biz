import {
  CalendarCheck,
  ClipboardList,
  Ellipsis,
  FileText,
  Globe,
  Package,
  Receipt,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Précision affichée à côté du libellé (ex. module facultatif). */
  hint?: string;
};

/** Navigation principale recommandée par le cahier des charges (§3). */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard/today", label: "Aujourd'hui", icon: CalendarCheck },
  { href: "/dashboard/orders", label: "Commandes", icon: ClipboardList },
  { href: "/dashboard/customers", label: "Clients", icon: Users },
  { href: "/dashboard/invoices", label: "Factures", icon: Receipt },
  { href: "/dashboard/catalog", label: "Catalogue", icon: Package },
  {
    href: "/dashboard/website",
    label: "Mon site",
    icon: Globe,
    hint: "facultatif",
  },
  { href: "/dashboard/settings", label: "Paramètres", icon: Settings },
];

/** Espaces secondaires, accessibles depuis « Plus » et la barre latérale. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/dashboard/quotes", label: "Devis", icon: FileText },
  { href: "/dashboard/payments", label: "Encaissements", icon: Wallet },
];

/** Barre du bas sur mobile : 4 raccourcis + « Plus » (lisible à 360 px). */
export const MOBILE_TAB_NAV: NavItem[] = [
  ...PRIMARY_NAV.slice(0, 4),
  { href: "/dashboard/more", label: "Plus", icon: Ellipsis },
];

/** Entrées regroupées sous « Plus » sur mobile. */
export const MORE_NAV: NavItem[] = [...PRIMARY_NAV.slice(4), ...SECONDARY_NAV];

export const NEW_ORDER_HREF = "/dashboard/orders/new";

export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard/more") {
    return (
      pathname === href ||
      MORE_NAV.some((item) => isActive(pathname, item.href))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
