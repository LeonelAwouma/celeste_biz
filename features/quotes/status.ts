import type { BusinessRole } from "@/lib/permissions/roles";

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Refusé",
  expired: "Expiré",
  cancelled: "Annulé",
};

export const QUOTE_STATUS_TONES: Record<
  QuoteStatus,
  "neutral" | "info" | "progress" | "success" | "danger"
> = {
  draft: "neutral",
  sent: "info",
  accepted: "success",
  rejected: "danger",
  expired: "progress",
  cancelled: "danger",
};

export type QuoteAction = {
  to: QuoteStatus;
  label: string;
  kind: "forward" | "back" | "danger";
  /** Une note est proposée (acceptation, refus) ou exigée (annulation). */
  note?: "optional" | "required";
};

const WRITERS: readonly BusinessRole[] = ["owner", "manager", "staff"];
const MANAGERS: readonly BusinessRole[] = ["owner", "manager"];

/**
 * Transitions de devis : miroir de `transition_quote` (la base reste la
 * référence et refuse tout le reste).
 */
const QUOTE_TRANSITIONS: readonly (QuoteAction & {
  from: QuoteStatus;
  roles: readonly BusinessRole[];
})[] = [
  {
    from: "draft",
    to: "sent",
    label: "Marquer comme envoyé",
    kind: "forward",
    roles: WRITERS,
  },
  {
    from: "draft",
    to: "cancelled",
    label: "Annuler le devis",
    kind: "danger",
    note: "required",
    roles: MANAGERS,
  },
  {
    from: "sent",
    to: "accepted",
    label: "Le client a accepté",
    kind: "forward",
    note: "optional",
    roles: WRITERS,
  },
  {
    from: "sent",
    to: "rejected",
    label: "Le client a refusé",
    kind: "back",
    note: "optional",
    roles: WRITERS,
  },
  {
    from: "sent",
    to: "draft",
    label: "Repasser en brouillon pour modifier",
    kind: "back",
    roles: WRITERS,
  },
  {
    from: "sent",
    to: "expired",
    label: "Marquer comme expiré",
    kind: "back",
    roles: WRITERS,
  },
  {
    from: "sent",
    to: "cancelled",
    label: "Annuler le devis",
    kind: "danger",
    note: "required",
    roles: MANAGERS,
  },
  {
    from: "expired",
    to: "draft",
    label: "Repasser en brouillon pour actualiser",
    kind: "back",
    roles: WRITERS,
  },
  {
    from: "expired",
    to: "cancelled",
    label: "Annuler le devis",
    kind: "danger",
    note: "required",
    roles: MANAGERS,
  },
];

export function availableQuoteActions(
  from: QuoteStatus,
  role: BusinessRole,
): QuoteAction[] {
  return QUOTE_TRANSITIONS.filter(
    (t) => t.from === from && t.roles.includes(role),
  ).map(({ to, label, kind, note }) => ({ to, label, kind, note }));
}

/** Date de validité dépassée (comparaison de dates locales AAAA-MM-JJ). */
export function isQuoteExpired(validUntil: string | null, today: string) {
  return Boolean(validUntil) && validUntil! < today;
}
