import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/loading-state";
import { TrackingDetails } from "@/components/tracking/tracking-details";

export const metadata: Metadata = {
  title: "Suivi de commande",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// Suivi client sans compte : le jeton est vérifié en base (condensat), un
// jeton inconnu donne toujours la même page « introuvable ».
export default function TrackingPage({ params }: PageProps<"/suivi/[token]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <TrackingDetails tokenPromise={params.then((p) => p.token)} />
    </Suspense>
  );
}
