import Link from "next/link";

import {
  getActiveBusiness,
  listMyBusinesses,
} from "@/features/businesses/active-business";
import { ROLE_LABELS } from "@/lib/permissions/roles";

import { BusinessSelect } from "./business-select";

/** Entreprise active et changement d'entreprise (si plusieurs). */
export async function BusinessSwitcher() {
  const [businesses, active] = await Promise.all([
    listMyBusinesses(),
    getActiveBusiness(),
  ]);

  if (!active) {
    return (
      <Link href="/onboarding" className="truncate text-sm text-primary">
        Créer mon entreprise
      </Link>
    );
  }

  if (businesses.length === 1) {
    return (
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium">{active.name}</span>
        <span className="text-muted-foreground">
          {" "}
          · {ROLE_LABELS[active.role]}
        </span>
      </span>
    );
  }

  return (
    <BusinessSelect
      activeId={active.id}
      options={businesses.map(({ id, name }) => ({ id, name }))}
    />
  );
}
