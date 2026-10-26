import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { TextareaField } from "@/components/forms/textarea-field";
import { detailInputName } from "@/features/orders/schemas";
import type { OrderField } from "@/features/professions/schema";

/** Champs propres au métier (profil versionné), validés côté serveur. */
export function OrderDetailFields({
  fields,
  values,
  errors,
  disabled,
}: {
  fields: readonly OrderField[];
  values: Record<string, string>;
  errors?: Record<string, string[] | undefined>;
  disabled?: boolean;
}) {
  return (
    <>
      {fields.map((field) => {
        const name = detailInputName(field.key);
        const label = field.required
          ? field.label
          : `${field.label} (facultatif)`;
        const common = {
          name,
          label,
          hint: field.help,
          errors: errors?.[name],
          disabled,
        };
        switch (field.type) {
          case "text":
            return (
              <FormField
                key={field.key}
                {...common}
                defaultValue={values[name]}
                maxLength={field.maxLength}
              />
            );
          case "textarea":
            return (
              <TextareaField
                key={field.key}
                {...common}
                defaultValue={values[name]}
                maxLength={field.maxLength}
              />
            );
          case "date":
            return (
              <FormField
                key={field.key}
                {...common}
                type="date"
                defaultValue={values[name]}
              />
            );
          case "datetime":
            return (
              <FormField
                key={field.key}
                {...common}
                type="datetime-local"
                defaultValue={values[name]}
              />
            );
          case "number":
            return (
              <FormField
                key={field.key}
                {...common}
                inputMode={field.integer ? "numeric" : "decimal"}
                defaultValue={values[name]}
              />
            );
          case "select":
            return (
              <SelectField
                key={field.key}
                name={name}
                label={label}
                disabled={disabled}
                errors={errors?.[name]}
                defaultValue={values[name] ?? ""}
                options={[
                  { value: "", label: "— Choisir —" },
                  ...field.options,
                ]}
              />
            );
          case "measurements":
            return (
              <fieldset
                key={field.key}
                disabled={disabled}
                className="flex flex-col gap-2"
              >
                <legend className="font-medium">
                  {label}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    en cm
                  </span>
                </legend>
                {field.help ? (
                  <p className="text-sm text-muted-foreground">{field.help}</p>
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  {field.points.map((point) => (
                    <FormField
                      key={point.key}
                      name={detailInputName(field.key, point.key)}
                      label={point.label}
                      inputMode="decimal"
                      defaultValue={
                        values[detailInputName(field.key, point.key)]
                      }
                    />
                  ))}
                </div>
                {errors?.[name]?.length ? (
                  <p className="text-sm text-destructive">{errors[name]![0]}</p>
                ) : null}
              </fieldset>
            );
        }
      })}
    </>
  );
}

/** Valeurs enregistrées → valeurs de formulaire (chaînes). */
export function detailsToFormValues(
  fields: readonly OrderField[],
  details: Record<string, unknown>,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = details[field.key];
    if (value === undefined || value === null) continue;
    if (field.type === "measurements" && typeof value === "object") {
      for (const [point, measure] of Object.entries(
        value as Record<string, unknown>,
      )) {
        values[detailInputName(field.key, point)] = String(measure);
      }
    } else {
      values[detailInputName(field.key)] = String(value);
    }
  }
  return values;
}
