import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
      const target = type === "recovery" ? "/update-password" : "/onboarding";
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?erreur=lien", request.url));
}
