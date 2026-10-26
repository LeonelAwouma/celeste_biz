import type { OrderItem } from "@/features/orders/queries";
import { sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf } from "@/lib/monetary/xaf";

/** Lignes d'une pièce (devis, facture) avec sous-total, taxes et total. */
export function LinesSummary({
  items,
  subtotal,
  taxTotal,
  total,
  label,
}: {
  items: OrderItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  label: string;
}) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label={label}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start justify-between gap-3 px-4 py-3"
        >
          <span className="flex min-w-0 flex-col">
            <span className="font-medium break-words">{item.name}</span>
            <span className="text-sm text-muted-foreground">
              {item.quantity.replace(".", ",")}
              {item.unit ? ` ${item.unit}` : ""} × {formatXaf(item.unitPrice)}
              {Number(item.discount) > 0
                ? ` − remise ${formatXaf(item.discount)}`
                : ""}
              {Number(item.taxRate) > 0
                ? ` · taxe ${item.taxRate.replace(".", ",")} %`
                : ""}
            </span>
          </span>
          <span className="shrink-0 font-medium">
            {formatXaf(sumAmounts([item.lineNet, item.lineTax]))}
          </span>
        </li>
      ))}
      {Number(taxTotal) > 0 ? (
        <>
          <li className="flex justify-between px-4 py-2 text-sm text-muted-foreground">
            <span>Total hors taxes</span>
            <span>{formatXaf(subtotal)}</span>
          </li>
          <li className="flex justify-between px-4 py-2 text-sm text-muted-foreground">
            <span>Taxes</span>
            <span>{formatXaf(taxTotal)}</span>
          </li>
        </>
      ) : null}
      <li className="flex justify-between px-4 py-3 font-semibold">
        <span>Total</span>
        <span data-testid="document-total">{formatXaf(total)}</span>
      </li>
    </ul>
  );
}
