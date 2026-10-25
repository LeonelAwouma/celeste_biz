"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useActionState, useState } from "react";

import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialFormState } from "@/features/auth/schemas";
import { inviteMember } from "@/features/businesses/actions";
import { INVITABLE_ROLES } from "@/features/businesses/schemas";
import { ROLE_LABELS } from "@/lib/permissions/roles";

const ROLE_HELP: Record<(typeof INVITABLE_ROLES)[number], string> = {
  manager: "commandes, clients, catalogue, devis, exports",
  staff: "créer et suivre les commandes",
  viewer: "consultation seulement",
};

/**
 * Invitation par lien à partager soi-même (WhatsApp, SMS…) : aucun message
 * n'est envoyé automatiquement depuis l'application.
 */
export function InviteForm() {
  const [state, action] = useActionState(inviteMember, initialFormState);
  const [copied, setCopied] = useState(false);
  const link = state.status === "success" ? state.data?.link : undefined;

  const shareText = link
    ? `Bonjour, je vous invite à rejoindre ${state.data?.businessName} sur Céleste Biz : ${link}`
    : "";

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h3 className="font-medium">Inviter un membre</h3>
      <form action={action} className="flex flex-col gap-4" noValidate>
        <FormMessage state={state} />
        {link ? (
          <div className="flex flex-col gap-2">
            <code
              data-testid="invitation-link"
              className="block rounded-md bg-muted px-3 py-2 text-sm break-all"
            >
              {link}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                <Copy aria-hidden="true" />
                {copied ? "Lien copié" : "Copier le lien"}
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle aria-hidden="true" />
                  Partager sur WhatsApp
                </a>
              </Button>
            </div>
          </div>
        ) : null}
        <FormField
          name="email"
          label="Adresse e-mail de la personne"
          type="email"
          inputMode="email"
          defaultValue={state.values?.email}
          hint="Elle devra se connecter avec cette adresse pour accepter."
          required
          errors={state.fieldErrors?.email}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-role">Rôle</Label>
          <select
            id="invite-role"
            name="role"
            defaultValue={state.values?.role || "staff"}
            className="min-h-11 rounded-md border border-input bg-card px-3"
          >
            {INVITABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]} : {ROLE_HELP[role]}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton variant="secondary" pendingLabel="Création du lien…">
          Créer un lien d&apos;invitation
        </SubmitButton>
      </form>
    </div>
  );
}
