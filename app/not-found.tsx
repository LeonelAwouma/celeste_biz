import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold">Page introuvable</h1>
      <p className="text-muted-foreground">
        Ce lien n&apos;existe pas ou n&apos;est plus disponible. S&apos;il
        s&apos;agit d&apos;un lien de suivi, demandez-en un nouveau à votre
        prestataire.
      </p>
      <Button asChild>
        <Link href="/">Retour à l&apos;accueil</Link>
      </Button>
    </main>
  );
}
