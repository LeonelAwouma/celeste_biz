import type { Metadata } from "next";

import { CreateBusinessForm } from "@/components/onboarding/create-business-form";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Votre entreprise · Céleste Biz",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl leading-tight font-semibold">
          Votre entreprise
        </h1>
        <CardDescription>
          Quelques informations pour adapter Céleste Biz à votre métier. Vous
          pourrez tout modifier plus tard, et aucun site web n&apos;est
          nécessaire.
        </CardDescription>
      </CardHeader>
      <CreateBusinessForm />
    </Card>
  );
}
