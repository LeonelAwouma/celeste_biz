import type { Metadata } from "next";

import { AuthPlaceholder } from "@/components/auth/auth-placeholder";

export const metadata: Metadata = { title: "Créer mon compte · Céleste Biz" };

export default function Page() {
  return (
    <AuthPlaceholder
      title="Créer mon compte"
      description="L'inscription sera disponible prochainement."
    />
  );
}
