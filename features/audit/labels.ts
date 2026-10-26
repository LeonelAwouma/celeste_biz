const ENTITIES: Record<string, string> = {
  business: "Entreprise",
  customer: "Client",
  catalog_item: "Article du catalogue",
  member: "Équipe",
  order: "Commande",
  payment: "Encaissement",
  quote: "Devis",
  invoice: "Facture",
  credit_note: "Avoir",
  fiscal_profile: "Profil de facturation",
  tracking_link: "Lien de suivi",
  website: "Site",
  campaign: "Campagne",
  export: "Export",
};

const VERBS: Record<string, string> = {
  created: "créé",
  updated: "modifié",
  archived: "archivé",
  restored: "restauré",
  cancelled: "annulé",
  issued: "émis",
  revoked: "révoqué",
  published: "publié",
  unpublished: "retiré",
  invited: "invitation envoyée",
  joined: "membre ajouté",
  role_changed: "rôle modifié",
  invitation_revoked: "invitation annulée",
  modules_changed: "modules modifiés",
  sent: "envoyé",
  accepted: "accepté",
  declined: "refusé",
  expired: "expiré",
  converted: "transformé en commande",
};

/** « customer.archived » → « Client : archivé » (repli : clé brute). */
export function auditActionLabel(action: string): string {
  const [entity, ...rest] = action.split(".");
  const verb = rest.join(".");
  const entityLabel = ENTITIES[entity];
  if (!entityLabel) return action;
  return `${entityLabel} : ${VERBS[verb] ?? verb.replace(/_/g, " ")}`;
}

/** Détails sûrs à afficher (jamais de jeton, de condensat ni de contenu). */
export function auditDetails(metadata: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof metadata.code === "string") parts.push(metadata.code);
  if (typeof metadata.number === "string") parts.push(metadata.number);
  if (typeof metadata.slug === "string") parts.push(`/sites/${metadata.slug}`);
  if (typeof metadata.rows === "number") parts.push(`${metadata.rows} lignes`);
  if (Array.isArray(metadata.changed) && metadata.changed.length)
    parts.push(`champs : ${metadata.changed.join(", ")}`);
  if (typeof metadata.reason === "string")
    parts.push(`motif : ${metadata.reason}`);
  return parts.length ? parts.join(" · ") : null;
}
