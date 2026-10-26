import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps = React.ComponentProps<typeof Textarea> & {
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
};

export function TextareaField({
  name,
  label,
  hint,
  errors,
  id = name,
  ...props
}: TextareaFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={
          [hintId, errorId].filter(Boolean).join(" ") || undefined
        }
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errors?.length ? (
        <p id={errorId} className="text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
