/**
 * Arithmétique décimale exacte pour l'aperçu des montants dans le
 * navigateur (entiers BigInt mis à l'échelle). Le serveur reste la
 * référence : les totaux enregistrés sont recalculés en SQL (`numeric`),
 * avec le même arrondi (moitié loin de zéro).
 */

const SCALE = 4n; // calculs internes à 4 décimales avant arrondi
const FACTOR = 10n ** SCALE;

/** « 1,5 » / « 1.5 » → « 1.5 » (au plus `maxDecimals` décimales), sinon null. */
export function parseDecimal(
  input: string,
  maxDecimals: number,
): string | null {
  const compact = input
    .trim()
    .replace(/[\s  ]/g, "")
    .replace(",", ".");
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(compact);
  if (!match) return null;
  const decimals = (match[2] ?? "").replace(/0+$/, "");
  if (decimals.length > maxDecimals) return null;
  const integer = match[1].replace(/^0+(?=\d)/, "");
  return decimals ? `${integer}.${decimals}` : integer;
}

function toScaled(value: string): bigint {
  const negative = value.startsWith("-");
  const [integer, decimals = ""] = value.replace("-", "").split(".");
  const scaled =
    BigInt(integer || "0") * FACTOR +
    BigInt((decimals + "0000").slice(0, Number(SCALE)) || "0");
  return negative ? -scaled : scaled;
}

/** Arrondi à 2 décimales, moitié loin de zéro (comme `round()` de Postgres). */
function roundToCents(scaled: bigint): bigint {
  const step = FACTOR / 100n;
  const half = step / 2n;
  const sign = scaled < 0n ? -1n : 1n;
  const magnitude = scaled * sign;
  return sign * (((magnitude + half) / step) * step);
}

function fromScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const magnitude = negative ? -scaled : scaled;
  const cents = magnitude / (FACTOR / 100n);
  const text = `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
  return negative ? `-${text}` : text;
}

/** Produit de deux décimaux, arrondi au centime. */
function multiply(a: string, b: string): bigint {
  return roundToCents((toScaled(a) * toScaled(b)) / FACTOR);
}

export type LineAmounts = { net: string; tax: string; total: string };

/** Montants d'une ligne : (quantité × prix arrondi) − remise, puis taxe. */
export function computeLine(
  quantity: string,
  unitPrice: string,
  discount = "0",
  taxRate = "0",
): LineAmounts {
  const net = multiply(quantity, unitPrice) - toScaled(discount);
  const tax = roundToCents((net * toScaled(taxRate)) / FACTOR / 100n);
  return {
    net: fromScaled(net),
    tax: fromScaled(tax),
    total: fromScaled(net + tax),
  };
}

export function sumAmounts(amounts: readonly string[]): string {
  return fromScaled(
    amounts.reduce((sum, amount) => sum + toScaled(amount), 0n),
  );
}

export function subtractAmounts(a: string, b: string): string {
  return fromScaled(toScaled(a) - toScaled(b));
}

export function compareAmounts(a: string, b: string): number {
  const diff = toScaled(a) - toScaled(b);
  return diff === 0n ? 0 : diff > 0n ? 1 : -1;
}
