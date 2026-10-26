"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCatalogPrice } from "@/features/catalog/format";
import { computeLine, parseDecimal, sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf, parseXafAmount, toInputAmount } from "@/lib/monetary/xaf";

export type CatalogOption = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
  priceMode: "fixed" | "from" | "quote";
  price: string | null;
};

export type LineValues = {
  catalogItemId: string | null;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  taxRate: string;
};

type Line = LineValues & { key: string; showOptions: boolean };

const emptyLine = (): Line => ({
  key: crypto.randomUUID(),
  catalogItemId: null,
  name: "",
  unit: "",
  quantity: "1",
  unitPrice: "",
  discount: "",
  taxRate: "",
  showOptions: false,
});

/** Montants d'une ligne pour l'aperçu, ou null si la saisie est incomplète. */
function previewLine(line: LineValues) {
  const quantity = parseDecimal(line.quantity, 3);
  const unitPrice = parseXafAmount(line.unitPrice);
  const discount = line.discount.trim() ? parseXafAmount(line.discount) : "0";
  const taxRate = line.taxRate.trim()
    ? parseDecimal(line.taxRate.replace("%", ""), 2)
    : "0";
  if (!quantity || !unitPrice || discount === null || taxRate === null)
    return null;
  return computeLine(quantity, unitPrice, discount, taxRate);
}

/**
 * Éditeur de lignes (commande, devis) : aperçu des montants en décimal exact,
 * le total définitif étant recalculé par la base. Les lignes partent dans le
 * champ caché `items` (JSON).
 */
export function LineItemsEditor({
  initialLines,
  catalog,
  locked = false,
  lockedNotice,
  errors,
  listLabel = "Lignes de la commande",
  totalTestId = "order-total",
}: {
  initialLines?: LineValues[];
  catalog: CatalogOption[];
  locked?: boolean;
  lockedNotice?: string;
  errors?: string[];
  listLabel?: string;
  totalTestId?: string;
}) {
  const [lines, setLines] = useState<Line[]>(() =>
    initialLines?.length
      ? initialLines.map((line) => ({
          ...line,
          key: crypto.randomUUID(),
          showOptions: false,
        }))
      : [emptyLine()],
  );
  const update = (key: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  function addFromCatalog(catalogId: string) {
    const item = catalog.find((entry) => entry.id === catalogId);
    if (!item) return;
    const line: Line = {
      ...emptyLine(),
      catalogItemId: item.id,
      name: item.name,
      unit: item.unit ?? "",
      unitPrice: item.price ? toInputAmount(item.price) : "",
    };
    // Remplace la première ligne si elle est encore vide.
    setLines((current) =>
      current.length === 1 && !current[0].name && !current[0].unitPrice
        ? [line]
        : [...current, line],
    );
  }

  const previews = lines.map(previewLine);
  const total = sumAmounts(
    previews.flatMap((preview) => (preview ? [preview.total] : [])),
  );
  const incomplete = previews.some((preview) => preview === null);

  return (
    <fieldset className="flex flex-col gap-3">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          lines.map(
            ({
              catalogItemId,
              name,
              unit,
              quantity,
              unitPrice,
              discount,
              taxRate,
            }) => ({
              catalogItemId: catalogItemId ?? "",
              name,
              unit,
              quantity,
              unitPrice,
              discount,
              taxRate,
            }),
          ),
        )}
      />
      <legend className="mb-1 text-lg font-semibold">Articles et prix</legend>
      {locked && lockedNotice ? (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {lockedNotice}
        </p>
      ) : null}
      {errors?.length ? (
        <ul className="text-sm text-destructive" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <ol className="flex flex-col gap-3" aria-label={listLabel}>
        {lines.map((line, index) => {
          const preview = previews[index];
          const prefix = `line-${line.key}`;
          return (
            <li
              key={line.key}
              className="flex flex-col gap-3 rounded-xl border bg-card p-3"
            >
              <div className="flex items-end gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Label htmlFor={`${prefix}-name`}>Ligne {index + 1}</Label>
                  <Input
                    id={`${prefix}-name`}
                    value={line.name}
                    disabled={locked}
                    placeholder="Ex. Robe en wax, Gâteau 3 étages"
                    onChange={(event) =>
                      update(line.key, {
                        name: event.target.value,
                        catalogItemId: null,
                      })
                    }
                    maxLength={200}
                    aria-label={`Libellé de la ligne ${index + 1}`}
                  />
                </div>
                {locked || lines.length === 1 ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Retirer la ligne ${index + 1}`}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((l) => l.key !== line.key),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-[5.5rem_1fr] gap-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${prefix}-qty`}>Quantité</Label>
                  <Input
                    id={`${prefix}-qty`}
                    inputMode="decimal"
                    value={line.quantity}
                    disabled={locked}
                    onChange={(event) =>
                      update(line.key, { quantity: event.target.value })
                    }
                    aria-label={`Quantité de la ligne ${index + 1}`}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`${prefix}-price`}>
                    Prix unitaire (FCFA){line.unit ? ` / ${line.unit}` : ""}
                  </Label>
                  <Input
                    id={`${prefix}-price`}
                    inputMode="decimal"
                    value={line.unitPrice}
                    disabled={locked}
                    placeholder="Ex. 15 000"
                    onChange={(event) =>
                      update(line.key, { unitPrice: event.target.value })
                    }
                    aria-label={`Prix unitaire de la ligne ${index + 1}`}
                  />
                </div>
              </div>
              {line.showOptions ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${prefix}-discount`}>Remise (FCFA)</Label>
                    <Input
                      id={`${prefix}-discount`}
                      inputMode="decimal"
                      value={line.discount}
                      disabled={locked}
                      onChange={(event) =>
                        update(line.key, { discount: event.target.value })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`${prefix}-tax`}>Taxe (%)</Label>
                    <Input
                      id={`${prefix}-tax`}
                      inputMode="decimal"
                      value={line.taxRate}
                      disabled={locked}
                      placeholder="0"
                      onChange={(event) =>
                        update(line.key, { taxRate: event.target.value })
                      }
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2 text-sm">
                {locked ? (
                  <span />
                ) : (
                  <button
                    type="button"
                    className="min-h-9 text-primary"
                    onClick={() =>
                      update(line.key, { showOptions: !line.showOptions })
                    }
                  >
                    {line.showOptions
                      ? "Masquer remise et taxe"
                      : "Remise ou taxe"}
                  </button>
                )}
                <span className="font-medium" aria-live="polite">
                  {preview ? formatXaf(preview.total) : "—"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {locked ? null : (
        <div className="flex flex-col gap-2">
          {catalog.length ? (
            <>
              <Label htmlFor="add-catalog-item">
                Ajouter depuis le catalogue
              </Label>
              <select
                id="add-catalog-item"
                value=""
                onChange={(event) => addFromCatalog(event.target.value)}
                className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base"
              >
                <option value="">— Choisir un article —</option>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ·{" "}
                    {formatCatalogPrice(item.priceMode, item.price, item.unit)}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            <Plus aria-hidden="true" />
            Ajouter une ligne libre
          </Button>
        </div>
      )}

      <p className="flex items-baseline justify-between rounded-xl bg-accent px-4 py-3 text-accent-foreground">
        <span className="font-medium">Total estimé</span>
        <span className="text-lg font-bold" data-testid={totalTestId}>
          {formatXaf(total)}
          {incomplete ? " *" : ""}
        </span>
      </p>
      {incomplete ? (
        <p className="text-xs text-muted-foreground">
          * Hors lignes incomplètes. Le total définitif est calculé à
          l&apos;enregistrement.
        </p>
      ) : null}
    </fieldset>
  );
}
