"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { acceptInvitation } from "@/features/businesses/actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Validation…">
        Accepter l&apos;invitation
      </SubmitButton>
    </form>
  );
}
