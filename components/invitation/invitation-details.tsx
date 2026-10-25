import Link from "next/link";

import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { invitationTokenSchema } from "@/features/businesses/schemas";
import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/env";
import { ROLE_LABELS, isBusinessRole } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import { AcceptInvitationForm } from "./accept-invitation-form";

function Message({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
      </CardHeader>
      {children}
    </Card>
  );
}

const UNAVAILABLE = (
  <Message title="Invitation indisponible">
    <CardDescription>
      Ce lien n&apos;est plus valable (expiré, annulé ou déjà utilisé). Demandez
      une nouvelle invitation à la personne qui vous l&apos;a envoyé.
    </CardDescription>
  </Message>
);

export async function InvitationDetails({
  tokenPromise,
}: {
  tokenPromise: Promise<string>;
}) {
  const parsed = invitationTokenSchema.safeParse(await tokenPromise);
  if (!parsed.success || !isSupabaseConfigured()) return UNAVAILABLE;
  const token = parsed.data;

  const user = await getCurrentUser();
  if (!user) {
    // Rien n'est révélé sans connexion (ni entreprise, ni adresse).
    return (
      <Message title="Vous êtes invité">
        <CardDescription>
          Une entreprise vous invite à rejoindre son équipe sur Céleste Biz.
          Connectez-vous ou créez un compte avec l&apos;adresse e-mail qui a
          reçu l&apos;invitation.
        </CardDescription>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link
              href={`/invitation/${token}/start?vers=signup`}
              prefetch={false}
            >
              Créer mon compte
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link
              href={`/invitation/${token}/start?vers=login`}
              prefetch={false}
            >
              J&apos;ai déjà un compte
            </Link>
          </Button>
        </div>
      </Message>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const invitation = (
    data as
      | { business_name: string; role: string; email: string; status: string }[]
      | null
  )?.[0];

  if (
    !invitation ||
    invitation.status !== "valid" ||
    !isBusinessRole(invitation.role)
  ) {
    return UNAVAILABLE;
  }

  if (user.email?.toLowerCase() !== invitation.email) {
    return (
      <Message title="Mauvais compte">
        <CardDescription>
          Cette invitation est destinée à {invitation.email}. Vous êtes connecté
          avec {user.email ?? "un autre compte"}. Déconnectez-vous puis
          reconnectez-vous avec la bonne adresse.
        </CardDescription>
        <SignOutButton className="justify-start" />
      </Message>
    );
  }

  return (
    <Message title={`Rejoindre ${invitation.business_name}`}>
      <CardDescription>
        Vous êtes invité comme <strong>{ROLE_LABELS[invitation.role]}</strong>.
        Vous verrez uniquement les données de cette entreprise permises par ce
        rôle.
      </CardDescription>
      <AcceptInvitationForm token={token} />
    </Message>
  );
}
