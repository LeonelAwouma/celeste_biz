import {
  OPTIONAL_MODULES,
  professionTemplateSchema,
  type ProfessionTemplate,
  type ProfessionTemplateInput,
} from "./schema";

/**
 * Registre des profils métiers (configuration déterministe, sans IA).
 *
 * Règle de versionnage : une version publiée est immuable. Toute
 * modification crée une nouvelle version (ajoutée à ce registre ET à une
 * migration SQL `profession_templates`) ; les entreprises gardent la version
 * qu'elles utilisent tant qu'elles ne sont pas migrées explicitement.
 * Le test d'intégration `profession-templates` vérifie que la base et ce
 * registre sont identiques.
 */
const TEMPLATES: ProfessionTemplateInput[] = [
  {
    key: "couture",
    version: 1,
    label: "Couture et confection",
    description:
      "Commandes sur mesure, prise de mesures, essayages, acomptes et dates de livraison.",
    labels: {
      catalog: "Modèles et prestations",
      catalogItem: "Prestation",
      order: "Commande sur mesure",
      orders: "Commandes",
    },
    defaultModules: ["quotes", "measurements", "website"],
    availableModules: ["quotes", "measurements", "website"],
    orderFields: [
      {
        key: "garment_type",
        label: "Type de vêtement",
        type: "select",
        required: true,
        options: [
          { value: "robe", label: "Robe" },
          { value: "ensemble", label: "Ensemble / tailleur" },
          { value: "costume", label: "Costume" },
          { value: "chemise", label: "Chemise" },
          { value: "pantalon", label: "Pantalon / jupe" },
          { value: "tenue_traditionnelle", label: "Tenue traditionnelle" },
          { value: "retouche", label: "Retouche" },
          { value: "autre", label: "Autre" },
        ],
      },
      {
        key: "fabric_source",
        label: "Tissu fourni par",
        type: "select",
        options: [
          { value: "client", label: "Le client" },
          { value: "atelier", label: "L'atelier" },
        ],
      },
      {
        key: "fitting_date",
        label: "Date d'essayage",
        type: "date",
      },
      {
        key: "measurements",
        label: "Mesures",
        help: "Facultatif. Visibles uniquement par l'équipe.",
        type: "measurements",
        unit: "cm",
        private: true,
        points: [
          { key: "tour_cou", label: "Tour de cou" },
          { key: "carrure", label: "Carrure (épaules)" },
          { key: "tour_poitrine", label: "Tour de poitrine" },
          { key: "tour_taille", label: "Tour de taille" },
          { key: "tour_hanches", label: "Tour de hanches" },
          { key: "longueur_manche", label: "Longueur de manche" },
          { key: "tour_bras", label: "Tour de bras" },
          { key: "longueur_buste", label: "Longueur du buste" },
          { key: "longueur_totale", label: "Longueur totale" },
          { key: "longueur_pantalon", label: "Longueur de pantalon" },
        ],
      },
      {
        key: "style_notes",
        label: "Modèle et finitions",
        help: "Description du modèle, référence photo, détails demandés.",
        type: "textarea",
      },
    ],
    stateLabels: {
      in_progress: "En confection",
      ready: "Prête à retirer",
    },
    productionSteps: [
      { key: "coupe", label: "Coupe" },
      { key: "assemblage", label: "Assemblage" },
      { key: "essayage", label: "Essayage" },
      { key: "finitions", label: "Finitions" },
    ],
  },
  {
    key: "catering",
    version: 1,
    label: "Pâtisserie et traiteur",
    description:
      "Commandes pour événements : date et lieu, nombre de portions, livraison, acomptes.",
    labels: {
      catalog: "Menus et produits",
      catalogItem: "Produit",
      order: "Commande d'événement",
      orders: "Commandes",
    },
    defaultModules: ["quotes", "events", "website"],
    availableModules: ["quotes", "events", "website"],
    orderFields: [
      {
        key: "event_date",
        label: "Date et heure de l'événement",
        type: "datetime",
        required: true,
      },
      {
        key: "event_type",
        label: "Type d'événement",
        type: "select",
        options: [
          { value: "anniversaire", label: "Anniversaire" },
          { value: "mariage", label: "Mariage / dot" },
          { value: "bapteme", label: "Baptême / communion" },
          { value: "entreprise", label: "Événement d'entreprise" },
          { value: "deuil", label: "Deuil / funérailles" },
          { value: "autre", label: "Autre" },
        ],
      },
      {
        key: "portions",
        label: "Nombre de portions ou d'invités",
        type: "number",
        integer: true,
        min: 1,
        max: 100000,
      },
      {
        key: "delivery_mode",
        label: "Mode de remise",
        type: "select",
        required: true,
        options: [
          { value: "retrait", label: "Retrait sur place" },
          { value: "livraison", label: "Livraison" },
          { value: "service", label: "Service sur place" },
        ],
      },
      {
        key: "event_location",
        label: "Lieu de livraison ou de l'événement",
        type: "text",
      },
      {
        key: "dietary_notes",
        label: "Allergies et préférences",
        type: "textarea",
      },
    ],
    stateLabels: {
      in_progress: "En préparation",
      ready: "Prête",
    },
    productionSteps: [
      { key: "courses", label: "Achats" },
      { key: "preparation", label: "Préparation" },
      { key: "cuisson", label: "Cuisson" },
      { key: "emballage", label: "Emballage" },
    ],
  },
  {
    key: "generic",
    version: 1,
    label: "Autre activité",
    description:
      "Services ou produits : demandes, devis, commandes, encaissements et suivi.",
    labels: {
      catalog: "Catalogue",
      catalogItem: "Article",
      order: "Commande",
      orders: "Commandes",
    },
    defaultModules: ["quotes", "website"],
    availableModules: ["quotes", "website"],
    orderFields: [
      {
        key: "details",
        label: "Détails de la demande",
        type: "textarea",
      },
    ],
    stateLabels: {},
    productionSteps: [],
  },
];

export const PROFESSION_TEMPLATES: readonly ProfessionTemplate[] =
  TEMPLATES.map((template) => professionTemplateSchema.parse(template));

export const PROFESSION_KEYS = ["couture", "catering", "generic"] as const;
export type ProfessionKey = (typeof PROFESSION_KEYS)[number];

export function isProfessionKey(value: unknown): value is ProfessionKey {
  return (
    typeof value === "string" &&
    (PROFESSION_KEYS as readonly string[]).includes(value)
  );
}

/** Version demandée, ou la plus récente ; profil générique en dernier recours. */
export function getProfessionTemplate(
  key: string,
  version?: number,
): ProfessionTemplate {
  const candidates = PROFESSION_TEMPLATES.filter((t) => t.key === key);
  const match =
    version === undefined
      ? candidates.at(-1)
      : candidates.find((t) => t.version === version);
  return (
    match ?? PROFESSION_TEMPLATES.filter((t) => t.key === "generic").at(-1)!
  );
}

export function latestProfessionTemplates(): ProfessionTemplate[] {
  return PROFESSION_KEYS.map((key) => getProfessionTemplate(key));
}

/** Libellés des modules facultatifs (paramètres de l'entreprise). */
export const OPTIONAL_MODULE_INFO: Record<
  (typeof OPTIONAL_MODULES)[number],
  { label: string; description: string }
> = {
  quotes: {
    label: "Devis",
    description: "Préparer des devis et les transformer en commandes.",
  },
  website: {
    label: "Mon site",
    description:
      "Site professionnel facultatif. Vos commandes fonctionnent sans site.",
  },
  measurements: {
    label: "Mesures",
    description:
      "Noter les mesures de vos clients, visibles par l'équipe seulement.",
  },
  events: {
    label: "Événements",
    description:
      "Date, lieu, portions et livraison de chaque commande d'événement.",
  },
};
