import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseEnv } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/update-password"];
const GUEST_ONLY_PATHS = ["/login", "/signup"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Rafraîchit la session Supabase (cookies) à chaque navigation et effectue
 * des redirections optimistes. L'autorisation réelle reste faite côté
 * serveur (couche d'accès aux données) et en base (RLS).
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = getSupabaseEnv();

  if (!env) {
    // Projet non branché : l'espace protégé renvoie vers la connexion, qui
    // explique que l'authentification n'est pas encore configurée.
    if (matches(pathname, PROTECTED_PREFIXES)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Ne rien exécuter entre la création du client et getClaims().
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  if (!signedIn && matches(pathname, PROTECTED_PREFIXES)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectTo(url);
  }

  if (signedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo(new URL("/dashboard/today", request.url));
  }

  return response;
}
