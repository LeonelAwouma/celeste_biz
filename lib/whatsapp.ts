/**
 * Lien de partage WhatsApp (`wa.me`) : ouvre WhatsApp avec un message
 * prérempli, que l'utilisateur relit et envoie lui-même. Aucun envoi
 * automatique, aucune API Meta.
 */
export function whatsappLink(phoneE164: string | null, text: string): string {
  const digits = phoneE164?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
