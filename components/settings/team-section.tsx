import { revokeInvitation } from "@/features/businesses/actions";
import type { PendingInvitation, TeamMember } from "@/features/businesses/team";
import { ROLE_LABELS } from "@/lib/permissions/roles";

import { InviteForm } from "./invite-form";
import { MemberActions } from "./member-actions";
import { SettingsCard } from "./settings-card";

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: "Africa/Douala",
});

export function TeamSection({
  canManage,
  members,
  invitations,
}: {
  canManage: boolean;
  members: TeamMember[];
  invitations: PendingInvitation[];
}) {
  return (
    <SettingsCard
      id="equipe"
      title="Équipe"
      description="Chaque membre ne voit que les données de cette entreprise, selon son rôle."
    >
      <ul className="flex flex-col divide-y" aria-label="Membres">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">
                {member.displayName}
                {member.isCurrentUser ? " (vous)" : ""}
              </span>
              <span className="text-sm text-muted-foreground">
                {ROLE_LABELS[member.role]}
              </span>
              {member.email ? (
                <span className="w-full truncate text-sm text-muted-foreground">
                  {member.email}
                </span>
              ) : null}
            </div>
            {canManage ? <MemberActions member={member} /> : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <>
          {invitations.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="font-medium">Invitations en attente</h3>
              <ul
                className="flex flex-col divide-y rounded-lg border"
                aria-label="Invitations en attente"
              >
                {invitations.map((invitation) => (
                  <li
                    key={invitation.id}
                    className="flex flex-wrap items-center gap-2 p-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {invitation.email} · {ROLE_LABELS[invitation.role]}
                      <span className="block text-muted-foreground">
                        Expire le{" "}
                        {dateFormat.format(new Date(invitation.expiresAt))}
                      </span>
                    </span>
                    <form action={revokeInvitation}>
                      <input
                        type="hidden"
                        name="invitationId"
                        value={invitation.id}
                      />
                      <button
                        type="submit"
                        className="min-h-11 px-2 text-destructive underline-offset-4 hover:underline"
                      >
                        Annuler
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <InviteForm />
        </>
      ) : null}
    </SettingsCard>
  );
}
