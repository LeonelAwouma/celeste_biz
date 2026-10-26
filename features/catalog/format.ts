import { formatXaf } from "@/lib/monetary/xaf";

export function formatCatalogPrice(
  priceMode: string,
  price: string | number | null,
  unit?: string | null,
): string {
  if (priceMode === "quote" || price === null) return "Sur devis";
  const amount = formatXaf(price);
  const suffix = unit ? ` / ${unit}` : "";
  return priceMode === "from"
    ? `À partir de ${amount}${suffix}`
    : `${amount}${suffix}`;
}
