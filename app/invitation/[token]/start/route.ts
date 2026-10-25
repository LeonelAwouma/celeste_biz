import { NextResponse, type NextRequest } from "next/server";

import { PENDING_INVITATION_COOKIE } from "@/features/businesses/invitation-cookie";
import { invitationTokenSchema } from "@/features/businesses/schemas";

/**
 * Mémorise l'invitation (cookie httpOnly, 7 jours) avant l'inscription ou la
 * connexion, pour y revenir après la confirmation de l'adresse e-mail.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/invitation/[token]/start">,
) {
  const parsed = invitationTokenSchema.safeParse((await params).token);
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const invitationPath = `/invitation/${parsed.data}`;
  const target =
    request.nextUrl.searchParams.get("vers") === "signup"
      ? new URL("/signup", request.url)
      : new URL(
          `/login?next=${encodeURIComponent(invitationPath)}`,
          request.url,
        );

  const response = NextResponse.redirect(target);
  response.cookies.set(PENDING_INVITATION_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
