/**
 * CSV pour Excel en français : UTF-8 avec BOM, séparateur « ; », fins de
 * ligne CRLF, toutes les cellules entre guillemets.
 *
 * Anti-injection de formules : une cellule de texte commençant par = + - @,
 * une tabulation ou un retour chariot est préfixée d'une apostrophe
 * (recommandation OWASP). Les montants, produits par l'application, sont
 * marqués comme tels et écrits avec une virgule décimale, sans préfixe.
 */
export type CsvCell = string | number | boolean | null | undefined | CsvAmount;
export type CsvAmount = { amount: string | number };

const FORMULA_START = /^[=+\-@\t\r]/;

export function amount(value: string | number | null | undefined): CsvCell {
  return value === null || value === undefined ? null : { amount: value };
}

function formatAmount(value: string | number): string {
  const fixed = typeof value === "number" ? value.toFixed(2) : value;
  return /^-?\d+(\.\d+)?$/.test(fixed) ? fixed.replace(".", ",") : "";
}

export function csvCell(value: CsvCell): string {
  let text: string;
  if (value === null || value === undefined) text = "";
  else if (typeof value === "object") text = formatAmount(value.amount);
  else if (typeof value === "boolean") text = value ? "oui" : "non";
  else if (typeof value === "number") text = String(value);
  else text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}
