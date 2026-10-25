import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les ressources statiques, les images et les routes publiques
    // qui n'ont pas besoin de session (suivi client, sites publics).
    "/((?!_next/static|_next/image|favicon.ico|suivi/|sites/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
