/**
 * Montants en francs CFA (XAF), manipulés en chaînes décimales : jamais de
 * calcul en virgule flottante côté client. Les calculs (totaux, soldes) sont
 * faits en SQL sur des `numeric`.
 */

const MAX_INTEGER_DIGITS = 16;

/**
 * Lit une saisie utilisateur (« 15 000 », « 15.000 », « 2 500,50 ») et
 * renvoie une chaîne décimale normalisée (« 15000.00 »), ou `null`.
 */
export function parseXafAmount(input: string): string | null {
  const compact = input
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(/fcfa|xaf|f$/i, "");
  if (!compact) return null;

  let integer: string;
  let decimals = "";

  if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    // « 15.000 » : point utilisé comme séparateur de milliers.
    integer = compact.replaceAll(".", "");
  } else {
    const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(compact);
    if (!match) return null;
    integer = match[1];
    decimals = match[2] ?? "";
  }

  integer = integer.replace(/^0+(?=\d)/, "");
  if (integer.length > MAX_INTEGER_DIGITS) return null;
  return `${integer}.${decimals.padEnd(2, "0")}`;
}

const GROUP_SEPARATOR = " ";

/** « 25 000 FCFA » (espace fine insécable, décimales seulement si non nulles). */
export function formatXaf(amount: string | number): string {
  const text = typeof amount === "number" ? amount.toFixed(2) : amount.trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!match) return `${text} FCFA`;
  const [, sign, integer, decimals = ""] = match;
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP_SEPARATOR);
  const cents = decimals.padEnd(2, "0").slice(0, 2);
  return `${sign}${grouped}${cents === "00" ? "" : `,${cents}`} FCFA`;
}

/** Valeur à préremplir dans un champ de saisie (« 25000 », « 2500,5 »). */
export function toInputAmount(
  amount: string | number | null | undefined,
): string {
  if (amount === null || amount === undefined) return "";
  const text = typeof amount === "number" ? amount.toFixed(2) : amount;
  const [integer, decimals = ""] = text.split(".");
  const trimmed = decimals.replace(/0+$/, "");
  return trimmed ? `${integer},${trimmed}` : integer;
}
