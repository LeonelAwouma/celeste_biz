/**
 * Ne garde que les chemins internes (« /… ») pour éviter les redirections
 * ouvertes via un paramètre `next` forgé.
 */
export function safeRedirectPath(
  value: unknown,
  fallback = "/dashboard/today",
): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
