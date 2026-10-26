import { redact, redactPath } from "./redact";

type Level = "info" | "warn" | "error";

/**
 * Journal structuré (une ligne JSON) lu par l'hébergeur (Vercel). Chaque
 * champ texte est masqué ; ne jamais y passer de contenu métier.
 */
export function logEvent(
  level: Level,
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
) {
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    safe[key] =
      typeof value === "string"
        ? key === "path"
          ? redactPath(value)
          : redact(value).slice(0, 500)
        : value;
  }
  const line = JSON.stringify({
    level,
    event,
    at: new Date().toISOString(),
    ...safe,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
