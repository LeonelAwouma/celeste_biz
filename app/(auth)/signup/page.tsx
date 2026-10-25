import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Créer mon compte · Céleste Biz" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Créer mon compte"
      description="Gratuit pendant la phase pilote. Aucun site web requis."
      footer={
        <p>
          Déjà inscrit ?{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
