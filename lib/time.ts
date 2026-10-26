/**
 * Dates et heures dans le fuseau de l'entreprise (Africa/Douala par défaut,
 * UTC+1 sans heure d'été). Stockage en UTC, saisie et affichage locaux.
 */
export const BUSINESS_TIME_ZONE = "Africa/Douala";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Décalage (ms) du fuseau à l'instant donné. */
function offsetAt(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * « 2026-11-02 » + « 14:30 » (heure locale) → instant ISO UTC. Sans heure :
 * fin de journée (18:00), heure habituelle de retrait. `null` si invalide.
 */
export function localDateTimeToIso(
  date: string,
  time = "",
  timeZone = BUSINESS_TIME_ZONE,
): string | null {
  if (!DATE.test(date) || (time && !TIME.test(time))) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "18:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return new Date(guess - offsetAt(guess, timeZone)).toISOString();
}

/** Instant ISO → { date: « 2026-11-02 », time: « 14:30 » } en heure locale. */
export function isoToLocalParts(
  iso: string,
  timeZone = BUSINESS_TIME_ZONE,
): { date: string; time: string } {
  const instant = new Date(iso).getTime();
  const local = new Date(instant + offsetAt(instant, timeZone));
  const [date, rest] = local.toISOString().split("T");
  return { date, time: rest.slice(0, 5) };
}

/** Date du jour (AAAA-MM-JJ) dans le fuseau de l'entreprise. */
export function todayLocal(
  timeZone = BUSINESS_TIME_ZONE,
  now = Date.now(),
): string {
  return isoToLocalParts(new Date(now).toISOString(), timeZone).date;
}

const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: BUSINESS_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** « lun. 2 nov., 14:30 » */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** « 2 novembre 2026 » (date seule, ex. AAAA-MM-JJ d'un encaissement). */
export function formatDate(value: string): string {
  const iso = DATE.test(value) ? `${value}T12:00:00Z` : value;
  return dateFormat.format(new Date(iso));
}
