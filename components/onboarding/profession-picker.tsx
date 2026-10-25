import { latestProfessionTemplates } from "@/features/professions/registry";
import { cn } from "@/lib/utils";

/** Choix du métier : grandes cartes radio, utilisables au doigt et au clavier. */
export function ProfessionPicker({
  defaultValue,
  errors,
}: {
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={errors?.length ? "profession-error" : undefined}
    >
      <legend className="mb-2 text-sm font-medium">Votre métier</legend>
      {latestProfessionTemplates().map((template) => (
        <label
          key={template.key}
          className={cn(
            "flex cursor-pointer gap-3 rounded-lg border bg-card p-3 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
          )}
        >
          <input
            type="radio"
            name="professionKey"
            value={template.key}
            defaultChecked={defaultValue === template.key}
            required
            className="mt-1 size-4 accent-[var(--primary)]"
          />
          <span className="flex flex-col">
            <span className="font-medium">{template.label}</span>
            <span className="text-sm text-muted-foreground">
              {template.description}
            </span>
          </span>
        </label>
      ))}
      {errors?.length ? (
        <p id="profession-error" className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </fieldset>
  );
}
