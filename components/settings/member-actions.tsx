"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { initialFormState } from "@/features/auth/schemas";
import { changeMemberRole, removeMember } from "@/features/businesses/actions";
import type { TeamMember } from "@/features/businesses/team";
import { BUSINESS_ROLES, ROLE_LABELS } from "@/lib/permissions/roles";

/** Actions critiques : confirmation explicite avant envoi (§3). */
function confirmBefore(message: string) {
  return (event: React.FormEvent<HTMLFormElement>) => {
    if (!window.confirm(message)) event.preventDefault();
  };
}

export function MemberActions({ member }: { member: TeamMember }) {
  const [roleState, roleAction] = useActionState(
    changeMemberRole,
    initialFormState,
  );
  const [removeState, removeAction] = useActionState(
    removeMember,
    initialFormState,
  );

  return (
    <div className="flex flex-col gap-2">
      <FormMessage state={roleState} />
      <FormMessage state={removeState} />
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={roleAction}
          onSubmit={confirmBefore(`Changer le rôle de ${member.displayName} ?`)}
          className="flex items-center gap-2"
        >
          <input type="hidden" name="userId" value={member.userId} />
          <label htmlFor={`role-${member.userId}`} className="sr-only">
            Rôle de {member.displayName}
          </label>
          <select
            id={`role-${member.userId}`}
            name="role"
            defaultValue={member.role}
            className="min-h-11 rounded-md border border-input bg-card px-2 text-sm"
          >
            {BUSINESS_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <SubmitButton size="sm" variant="outline" pendingLabel="…">
            Changer le rôle
          </SubmitButton>
        </form>
        {member.isCurrentUser ? null : (
          <form
            action={removeAction}
            onSubmit={confirmBefore(
              `Retirer l'accès de ${member.displayName} ? Cette personne ne verra plus les données de l'entreprise.`,
            )}
          >
            <input type="hidden" name="userId" value={member.userId} />
            <SubmitButton
              size="sm"
              variant="ghost"
              className="text-destructive"
              pendingLabel="…"
            >
              Retirer l&apos;accès
            </SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}
