import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { MORE_NAV } from "@/components/dashboard/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export const metadata: Metadata = { title: "Plus" };

export default function MorePage() {
  return (
    <>
      <PageHeader title="Plus" />
      <nav aria-label="Autres espaces">
        <ul className="divide-y rounded-xl border bg-card">
          {MORE_NAV.map(({ href, label, hint, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-14 items-center gap-3 px-4 hover:bg-accent"
              >
                <Icon aria-hidden="true" className="size-5 text-primary" />
                <span className="font-medium">{label}</span>
                {hint ? (
                  <span className="text-sm text-muted-foreground">
                    ({hint})
                  </span>
                ) : null}
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto size-5 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/onboarding"
          className="flex min-h-11 items-center px-4 text-primary"
        >
          Créer une autre entreprise
        </Link>
        <SignOutButton className="justify-start" />
      </div>
    </>
  );
}
