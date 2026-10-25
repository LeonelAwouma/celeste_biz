"use client";

import { useRef, useTransition } from "react";

import { setActiveBusiness } from "@/features/businesses/actions";

export function BusinessSelect({
  activeId,
  options,
}: {
  activeId: string;
  options: { id: string; name: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={(formData) => startTransition(() => setActiveBusiness(formData))}
      className="min-w-0"
      aria-busy={pending}
    >
      <label htmlFor="business-switcher" className="sr-only">
        Entreprise active
      </label>
      <select
        id="business-switcher"
        name="businessId"
        defaultValue={activeId}
        disabled={pending}
        onChange={() => formRef.current?.requestSubmit()}
        className="min-h-11 max-w-full truncate rounded-md border border-input bg-card px-2 text-sm font-medium disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="ml-2 text-sm text-primary">
          Changer
        </button>
      </noscript>
    </form>
  );
}
