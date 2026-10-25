"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Indique clairement que la connexion est requise (MVP connecté, pas de
 * mode hors ligne) : rien n'est enregistré tant que le réseau est coupé.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-warning px-4 py-2 text-sm font-medium text-warning-foreground"
    >
      <WifiOff aria-hidden="true" className="size-4 shrink-0" />
      Connexion requise : vos modifications ne seront pas enregistrées tant que
      le réseau est coupé.
    </div>
  );
}
