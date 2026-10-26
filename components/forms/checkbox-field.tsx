export function CheckboxField({
  name,
  label,
  description,
  defaultChecked,
  disabled,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="mt-1 size-5 shrink-0 accent-[var(--primary)]"
      />
      <span className="flex flex-col">
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="text-sm text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
