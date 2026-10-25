import type { Metadata } from "next";

import { AuthPlaceholder } from "@/components/auth/auth-placeholder";

export const metadata: Metadata = {
  title: "Mot de passe oublié · Céleste Biz",
};

export default function Page() {
  return (
    <AuthPlaceholder
      title="Mot de passe oublié"
      description="La récupération de compte sera disponible prochainement."
    />
  );
}
