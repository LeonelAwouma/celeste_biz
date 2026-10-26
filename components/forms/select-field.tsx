import { Label } from "@/components/ui/label";

type SelectFieldProps = React.ComponentProps<"select"> & {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  errors?: string[];
};

export function SelectField({
  name,
  label,
  options,
  errors,
  id = name,
  ...props
}: SelectFieldProps) {
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errorId}
        className="min-h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 text-base disabled:opacity-50"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors?.length ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
