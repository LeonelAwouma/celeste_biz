import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Nouveau mot de passe · Céleste Biz",
};

export default function UpdatePasswordPage() {
  return (
    <AuthCard title="Nouveau mot de passe">
      <UpdatePasswordForm />
    </AuthCard>
  );
}
