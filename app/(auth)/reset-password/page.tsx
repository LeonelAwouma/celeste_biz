import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetRequestForm } from "@/components/auth/reset-request-form";

export const metadata: Metadata = {
  title: "Mot de passe oublié · Céleste Biz",
};

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Mot de passe oublié"
      description="Indiquez votre adresse : nous vous enverrons un lien pour choisir un nouveau mot de passe."
      footer={
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}
