import type { OrderField } from "@/features/professions/schema";
import { formatDate, formatDateTime, localDateTimeToIso } from "@/lib/time";

function displayValue(field: OrderField, value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  switch (field.type) {
    case "select":
      return (
        field.options.find((option) => option.value === value)?.label ??
        String(value)
      );
    case "date":
      return formatDate(String(value));
    case "datetime": {
      const [date, time] = String(value).split("T");
      const iso = localDateTimeToIso(date, time);
      return iso ? formatDateTime(iso) : String(value);
    }
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    default:
      return String(value);
  }
}

/** Informations métier enregistrées (lecture). */
export function OrderDetailsView({
  fields,
  details,
}: {
  fields: readonly OrderField[];
  details: Record<string, unknown>;
}) {
  const rows = fields.flatMap((field) => {
    const value = details[field.key];
    if (field.type === "measurements") {
      const measures = (value ?? {}) as Record<string, unknown>;
      const filled = field.points.filter(
        (point) => measures[point.key] !== undefined,
      );
      if (!filled.length) return [];
      return [
        <div key={field.key} className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">
            {field.label}
            {field.private ? " · interne" : ""}
          </dt>
          <dd>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {filled.map((point) => (
                <li key={point.key}>
                  {point.label} :{" "}
                  <span className="font-medium">
                    {String(measures[point.key])} cm
                  </span>
                </li>
              ))}
            </ul>
          </dd>
        </div>,
      ];
    }
    const text = displayValue(field, value);
    if (!text) return [];
    return [
      <div key={field.key} className="flex flex-col gap-0.5">
        <dt className="text-sm text-muted-foreground">
          {field.label}
          {field.private ? " · interne" : ""}
        </dt>
        <dd className="whitespace-pre-line">{text}</dd>
      </div>,
    ];
  });

  if (!rows.length) return null;
  return <dl className="flex flex-col gap-3">{rows}</dl>;
}
