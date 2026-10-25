import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/components/feedback/loading-state";
import { InvitationDetails } from "@/components/invitation/invitation-details";

export const metadata: Metadata = {
  title: "Invitation · Céleste Biz",
  robots: { index: false, follow: false },
};

export default function InvitationPage({
  params,
}: PageProps<"/invitation/[token]">) {
  return (
    <Suspense fallback={<LoadingState />}>
      <InvitationDetails tokenPromise={params.then((p) => p.token)} />
    </Suspense>
  );
}
