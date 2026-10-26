/**
 * Modèles de site : deux modèles métier et un générique. Un modèle fixe
 * l'ordre des sections et les intitulés ; le contenu vient du commerçant.
 */
export const SITE_TEMPLATE_KEYS = ["couture", "catering", "generic"] as const;
export type SiteTemplateKey = (typeof SITE_TEMPLATE_KEYS)[number];

export type SiteSection = "services" | "gallery" | "about" | "hours";

export type SiteTemplate = {
  key: SiteTemplateKey;
  label: string;
  description: string;
  sections: SiteSection[];
  servicesTitle: string;
  galleryTitle: string;
  /** Message prérempli du bouton WhatsApp. */
  contactText: string;
  headlinePlaceholder: string;
};

export const SITE_TEMPLATES: Record<SiteTemplateKey, SiteTemplate> = {
  couture: {
    key: "couture",
    label: "Atelier de couture",
    description: "Galerie de créations en avant, puis prestations et tarifs.",
    sections: ["gallery", "services", "about", "hours"],
    servicesTitle: "Prestations",
    galleryTitle: "Nos créations",
    contactText: "Bonjour, je vous contacte depuis votre site pour une tenue.",
    headlinePlaceholder: "Couture sur mesure, robes et tenues de cérémonie",
  },
  catering: {
    key: "catering",
    label: "Pâtisserie et traiteur",
    description: "Menus et produits en avant, puis photos et horaires.",
    sections: ["services", "gallery", "hours", "about"],
    servicesTitle: "Menus et produits",
    galleryTitle: "En images",
    contactText:
      "Bonjour, je vous contacte depuis votre site pour une commande.",
    headlinePlaceholder: "Gâteaux et buffets pour vos événements",
  },
  generic: {
    key: "generic",
    label: "Générique",
    description: "Présentation simple : à propos, prestations, photos.",
    sections: ["about", "services", "gallery", "hours"],
    servicesTitle: "Nos offres",
    galleryTitle: "Photos",
    contactText: "Bonjour, je vous contacte depuis votre site.",
    headlinePlaceholder: "Ce que vous proposez, en une phrase",
  },
};

export function isSiteTemplateKey(value: unknown): value is SiteTemplateKey {
  return (SITE_TEMPLATE_KEYS as readonly unknown[]).includes(value);
}

export function getSiteTemplate(key: unknown): SiteTemplate {
  return isSiteTemplateKey(key) ? SITE_TEMPLATES[key] : SITE_TEMPLATES.generic;
}

/** Couleurs d'accent : texte blanc lisible (contraste ≥ 4,5:1) sur chacune. */
export const SITE_ACCENTS = {
  indigo: { label: "Indigo", color: "#3730a3" },
  emerald: { label: "Émeraude", color: "#047857" },
  terracotta: { label: "Terre cuite", color: "#9a3412" },
  plum: { label: "Prune", color: "#86198f" },
  charcoal: { label: "Anthracite", color: "#1f2937" },
} as const;
export type SiteAccent = keyof typeof SITE_ACCENTS;

export function isSiteAccent(value: unknown): value is SiteAccent {
  return typeof value === "string" && value in SITE_ACCENTS;
}
