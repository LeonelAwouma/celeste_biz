import type {
  OrderState,
  ProfessionTemplate,
} from "@/features/professions/schema";
import type { BusinessRole } from "@/lib/permissions/roles";

export const ORDER_STATUS_LABELS: Record<OrderState, string> = {
  draft: "Brouillon",
  pending_confirmation: "À confirmer",
  confirmed: "Confirmée",
  in_progress: "En cours",
  ready: "Prête",
  delivered: "Livrée",
  closed: "Clôturée",
  cancelled: "Annulée",
  disputed: "En litige",
};

/** Libellé d'état, éventuellement propre au métier (« En confection »). */
export function statusLabel(
  status: OrderState,
  template?: ProfessionTemplate,
): string {
  return template?.stateLabels[status] ?? ORDER_STATUS_LABELS[status];
}

export const STATUS_TONES: Record<
  OrderState,
  "neutral" | "info" | "progress" | "success" | "danger"
> = {
  draft: "neutral",
  pending_confirmation: "info",
  confirmed: "info",
  in_progress: "progress",
  ready: "success",
  delivered: "success",
  closed: "neutral",
  cancelled: "danger",
  disputed: "danger",
};

type Transition = readonly [OrderState, OrderState, readonly BusinessRole[]];

const WRITERS = ["owner", "manager", "staff"] as const;
const MANAGERS = ["owner", "manager"] as const;

/**
 * Transitions autorisées : miroir exact de `order_status_transitions`
 * (vérifié par un test d'intégration). La base reste la référence.
 */
export const ORDER_TRANSITIONS: readonly Transition[] = [
  ["draft", "pending_confirmation", WRITERS],
  ["draft", "confirmed", WRITERS],
  ["draft", "cancelled", MANAGERS],
  ["pending_confirmation", "confirmed", WRITERS],
  ["pending_confirmation", "draft", WRITERS],
  ["pending_confirmation", "cancelled", MANAGERS],
  ["confirmed", "in_progress", WRITERS],
  ["confirmed", "ready", WRITERS],
  ["confirmed", "cancelled", MANAGERS],
  ["confirmed", "disputed", MANAGERS],
  ["in_progress", "ready", WRITERS],
  ["in_progress", "confirmed", WRITERS],
  ["in_progress", "cancelled", MANAGERS],
  ["in_progress", "disputed", MANAGERS],
  ["ready", "delivered", WRITERS],
  ["ready", "in_progress", WRITERS],
  ["ready", "cancelled", MANAGERS],
  ["ready", "disputed", MANAGERS],
  ["delivered", "closed", MANAGERS],
  ["delivered", "disputed", MANAGERS],
  ["disputed", "in_progress", MANAGERS],
  ["disputed", "ready", MANAGERS],
  ["disputed", "delivered", MANAGERS],
  ["disputed", "closed", MANAGERS],
  ["disputed", "cancelled", MANAGERS],
];

/** Ordre « vers l'avant » : sert à distinguer avancer / revenir en arrière. */
const PROGRESS: Partial<Record<OrderState, number>> = {
  draft: 0,
  pending_confirmation: 1,
  confirmed: 2,
  in_progress: 3,
  ready: 4,
  delivered: 5,
  closed: 6,
};

export type TransitionAction = {
  to: OrderState;
  label: string;
  kind: "forward" | "back" | "danger";
};

const FORWARD_LABELS: Partial<Record<OrderState, string>> = {
  pending_confirmation: "Mettre en attente de confirmation",
  confirmed: "Confirmer la commande",
  in_progress: "Démarrer la réalisation",
  ready: "Marquer comme prête",
  delivered: "Marquer comme remise au client",
  closed: "Clôturer",
};

/** Actions possibles pour ce rôle depuis l'état courant (affichage). */
export function availableTransitions(
  from: OrderState,
  role: BusinessRole,
  template?: ProfessionTemplate,
): TransitionAction[] {
  return ORDER_TRANSITIONS.filter(
    ([f, , roles]) => f === from && roles.includes(role),
  ).map(([, to]) => {
    if (to === "cancelled")
      return { to, label: "Annuler la commande", kind: "danger" };
    if (to === "disputed")
      return { to, label: "Signaler un litige", kind: "danger" };
    const back =
      from !== "disputed" && (PROGRESS[to] ?? 0) < (PROGRESS[from] ?? 0);
    return back
      ? {
          to,
          label: `Revenir à « ${statusLabel(to, template)} »`,
          kind: "back",
        }
      : {
          to,
          label: FORWARD_LABELS[to] ?? statusLabel(to, template),
          kind: "forward",
        };
  });
}

/** États où les lignes, le client et les prix peuvent encore changer. */
export function itemsEditable(status: OrderState): boolean {
  return status === "draft" || status === "pending_confirmation";
}

export function isTerminal(status: OrderState): boolean {
  return status === "closed" || status === "cancelled";
}

export const PAYMENT_METHOD_LABELS = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  other: "Autre",
} as const;

export type PaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;
export const PAYMENT_METHODS = Object.keys(
  PAYMENT_METHOD_LABELS,
) as PaymentMethod[];

/** Statuts honnêtes : un encaissement manuel n'est jamais « vérifié ». */
export const PAYMENT_STATUS_LABELS = {
  manual_declared: "Enregistré manuellement, non vérifié auprès de l'opérateur",
  pending_provider: "En attente de confirmation du prestataire",
  provider_verified: "Confirmé par le prestataire de paiement",
  failed: "Échoué",
  refunded: "Remboursé",
  cancelled: "Annulé",
} as const;

export type PaymentStatus = keyof typeof PAYMENT_STATUS_LABELS;

const NOT_LATE: readonly OrderState[] = [
  "draft",
  "delivered",
  "closed",
  "cancelled",
];

/** Échéance dépassée pour une commande encore à remettre. */
export function isLate(
  dueAt: string | null,
  status: OrderState,
  now = Date.now(),
): boolean {
  return (
    Boolean(dueAt) && Date.parse(dueAt!) < now && !NOT_LATE.includes(status)
  );
}
