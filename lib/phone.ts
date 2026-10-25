/**
 * Normalise un numéro de téléphone au format E.164.
 * Numéros camerounais acceptés sans indicatif (9 chiffres commençant par 6
 * ou 2) ; numéros étrangers acceptés avec « + » ou « 00 ».
 * Renvoie `null` si le numéro est invalide.
 */
export function normalizePhoneE164(input: string): string | null {
  const compact = input.trim().replace(/[\s.\-()/]/g, "");
  if (!compact) return null;

  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else if (/^[26]\d{8}$/.test(compact)) digits = `237${compact}`;
  else if (/^237[26]\d{8}$/.test(compact)) digits = compact;
  else return null;

  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("237") && !/^237[26]\d{8}$/.test(digits)) return null;
  return `+${digits}`;
}

/** Affichage lisible : +237 6 77 12 34 56. */
export function formatPhone(e164: string): string {
  const cameroon = /^\+237(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return cameroon ? `+237 ${cameroon.slice(1).join(" ")}` : e164;
}
