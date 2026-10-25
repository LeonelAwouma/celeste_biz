import type { Metadata } from "next";

import { AuthPlaceholder } from "@/components/auth/auth-placeholder";

export const metadata: Metadata = { title: "Se connecter · Céleste Biz" };

export default function Page() {
  return (
    <AuthPlaceholder
      title="Se connecter"
      description="La connexion sera disponible prochainement."
    />
  );
}
