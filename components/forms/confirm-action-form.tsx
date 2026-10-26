"use client";

import { SubmitButton } from "./submit-button";

/**
 * Formulaire d'action critique (archivage, suppression…) : confirmation
 * explicite avant l'envoi.
 */
export function ConfirmActionForm({
  action,
  confirmMessage,
  hidden,
  children,
  variant = "outline",
}: {
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  hidden: Record<string, string>;
  children: React.ReactNode;
  variant?: "outline" | "destructive" | "ghost";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} pendingLabel="…">
        {children}
      </SubmitButton>
    </form>
  );
}
