import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { PENDING_INVITATION_COOKIE } from "@/features/businesses/invitation-cookie";
import { invitationTokenSchema } from "@/features/businesses/schemas";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery"];

/**
 * Lien reçu par e-mail (confirmation d'adresse ou réinitialisation) :
 * vérifie le jeton côté serveur puis ouvre la session.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/update-password", request.url));
      }
      // Inscription faite depuis une invitation : retour à l'invitation.
      const pending = invitationTokenSchema.safeParse(
        request.cookies.get(PENDING_INVITATION_COOKIE)?.value,
      );
      const target = pending.success
        ? `/invitation/${pending.data}`
        : "/onboarding";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?erreur=lien", request.url));
}
