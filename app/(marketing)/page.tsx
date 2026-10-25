import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Globe,
  MessageCircle,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Commandes organisées",
    description:
      "Chaque commande avec ses détails, son délai et son état. Plus rien d'oublié.",
  },
  {
    icon: Wallet,
    title: "Acomptes et soldes",
    description:
      "Enregistrez les acomptes et retrouvez en un coup d'œil ce qui reste à encaisser, en FCFA.",
  },
  {
    icon: FileText,
    title: "Devis et factures",
    description:
      "Préparez des devis et des factures propres, directement depuis votre téléphone.",
  },
  {
    icon: Users,
    title: "Vos clients",
    description:
      "L'historique de chaque client au même endroit. Vos clients restent les vôtres.",
  },
  {
    icon: MessageCircle,
    title: "Compatible WhatsApp",
    description:
      "Continuez à vendre sur WhatsApp, Facebook ou à l'atelier, et partagez un lien de suivi.",
  },
  {
    icon: Globe,
    title: "Site web facultatif",
    description:
      "Créez un site si vous le souhaitez, plus tard. Il n'est jamais obligatoire.",
  },
];

export default function MarketingHome() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
        <span className="text-lg font-bold text-primary">Céleste Biz</span>
        <Button asChild variant="ghost" className="ml-auto">
          <Link href="/login">Se connecter</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-8 pb-12 text-center md:pt-16">
          <h1 className="text-3xl leading-tight font-bold md:text-5xl">
            Continuez à vendre comme vous en avez l&apos;habitude.
          </h1>
          <p className="text-lg text-muted-foreground">
            Céleste Biz vous aide à organiser vos commandes, retrouver vos
            soldes, facturer et suivre vos clients, sans vous obliger à créer un
            site web.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">Créer mon compte</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/dashboard/today">Découvrir l&apos;espace</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Pensé pour les couturiers, pâtissiers, traiteurs et vendeurs sur les
            réseaux sociaux.
          </p>
        </section>

        <section
          aria-labelledby="fonctionnalites"
          className="mx-auto max-w-5xl px-4 pb-16"
        >
          <h2 id="fonctionnalites" className="sr-only">
            Fonctionnalités
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title}>
                <Card className="h-full">
                  <CardHeader>
                    <Icon aria-hidden="true" className="size-7 text-primary" />
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
        © Céleste Biz — Cameroun
      </footer>
    </div>
  );
}
