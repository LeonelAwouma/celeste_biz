export const BUSINESS_ROLES = ["owner", "manager", "staff", "viewer"] as const;
export type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const ROLE_LABELS: Record<BusinessRole, string> = {
  owner: "Propriétaire",
  manager: "Gestionnaire",
  staff: "Employé",
  viewer: "Lecteur",
};

/**
 * Matrice des droits (§2 du cahier des charges). Elle sert à l'affichage et
 * aux contrôles des actions serveur ; la base applique les mêmes règles via
 * la RLS et les fonctions SQL, qui restent la barrière de référence.
 */
const PERMISSIONS = {
  "business.update": ["owner"],
  "business.close": ["owner"],
  "members.manage": ["owner"],
  "subscription.manage": ["owner"],
  "audit.read": ["owner", "manager"],
  "exports.run": ["owner", "manager"],
  "catalog.write": ["owner", "manager"],
  "customers.write": ["owner", "manager", "staff"],
  "customers.archive": ["owner", "manager"],
  "orders.write": ["owner", "manager", "staff"],
  "business.read": ["owner", "manager", "staff", "viewer"],
} as const satisfies Record<string, readonly BusinessRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: BusinessRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly BusinessRole[]).includes(role);
}

export function isBusinessRole(value: unknown): value is BusinessRole {
  return (
    typeof value === "string" &&
    (BUSINESS_ROLES as readonly string[]).includes(value)
  );
}
