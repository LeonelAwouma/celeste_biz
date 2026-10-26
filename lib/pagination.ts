/** Curseur opaque (base64url) pour la pagination par clé. */
export function encodeCursor(value: Record<string, string>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeCursor<K extends string>(
  cursor: string | undefined,
  keys: readonly K[],
): Record<K, string> | null {
  if (!cursor || cursor.length > 500) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!value || typeof value !== "object") return null;
    for (const key of keys) {
      if (typeof value[key] !== "string") return null;
    }
    return value as Record<K, string>;
  } catch {
    return null;
  }
}
