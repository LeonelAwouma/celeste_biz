import type { Instrumentation } from "next";

import { logEvent } from "@/lib/observability/log";

/**
 * Erreurs serveur : une ligne JSON masquée (chemin sans jeton ni requête,
 * message sans e-mail, téléphone ni clé). Le `digest` relie l'erreur à la
 * page d'erreur vue par l'utilisateur. Un service d'alerte (ex. Sentry)
 * pourra être branché ici une fois le compte choisi.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String(error.digest)
      : undefined;
  logEvent("error", "request_error", {
    message: error instanceof Error ? error.message : String(error),
    name: error instanceof Error ? error.name : undefined,
    digest,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
};
