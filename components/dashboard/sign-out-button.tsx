import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" className={className}>
        <LogOut aria-hidden="true" />
        Se déconnecter
      </Button>
    </form>
  );
}
