/**
 * Masquage des données sensibles avant journalisation : jetons de suivi et
 * d'invitation, clés, JWT, numéros de téléphone, e-mails. Les journaux
 * techniques ne doivent contenir ni secret ni donnée personnelle complète.
 */
const RULES: [RegExp, string][] = [
  // Jetons dans les chemins (suivi client, invitations, confirmations).
  [/\/(suivi|invitation)\/[A-Za-z0-9_-]{16,}/g, "/$1/[jeton]"],
  [
    /([?&](?:token|token_hash|code|access_token|refresh_token)=)[^&\s]+/gi,
    "$1[masqué]",
  ],
  // JWT et clés Supabase.
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[clé]"],
  // Adresses e-mail et numéros de téléphone (on garde les 2 derniers chiffres).
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[e-mail]"],
  [/(?<![\w-])\+?(?:\d[ \u00a0.]?){6,13}(\d{2})\b/g, "[tél. …$1]"],
];

export function redact(value: string): string {
  return RULES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value,
  );
}

/** Chemin journalisable : sans requête (paramètres potentiellement sensibles). */
export function redactPath(path: string): string {
  return redact(path.split("?")[0]);
}
