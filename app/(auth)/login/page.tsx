import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Se connecter · Céleste Biz" };

export default function LoginPage() {
  return (
    <AuthCard
      title="Se connecter"
      description="Retrouvez vos commandes, clients et soldes."
      footer={
        <p>
          Pas encore de compte ?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
