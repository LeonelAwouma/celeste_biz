import Link from "next/link";
import { CircleCheck, Circle, ChevronRight } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { BusinessContext } from "@/features/businesses/active-business";
import { can } from "@/lib/permissions/roles";

type Step = {
  label: string;
  href?: string;
  done?: boolean;
  optional?: boolean;
};

/**
 * « Premiers pas » : liste déterministe adaptée au métier. Les étapes
 * facultatives (équipe, site) le restent explicitement.
 */
export function GettingStarted({ context }: { context: BusinessContext }) {
  const { template, modules, business } = context;
  const steps: Step[] = [
    { label: "Créer votre entreprise", done: true },
    {
      label: `Ajouter votre première ${template.labels.catalogItem.toLowerCase()}`,
      href: "/dashboard/catalog",
    },
    {
      label: `Enregistrer votre première ${template.labels.order.toLowerCase()}`,
      href: "/dashboard/orders/new",
    },
  ];
  if (can(business.role, "members.manage")) {
    steps.push({
      label: "Inviter un employé",
      href: "/dashboard/settings#equipe",
      optional: true,
    });
  }
  if (modules.has("website")) {
    steps.push({
      label: "Créer mon site",
      href: "/dashboard/website",
      optional: true,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="text-lg">Premiers pas</span>
        </CardTitle>
        <CardDescription>
          Vous pouvez gérer vos commandes sans site web ni chatbot.
        </CardDescription>
      </CardHeader>
      <ol className="flex flex-col divide-y">
        {steps.map((step) => {
          const Icon = step.done ? CircleCheck : Circle;
          const content = (
            <>
              <Icon
                aria-hidden="true"
                className={
                  step.done
                    ? "size-5 shrink-0 text-primary"
                    : "size-5 shrink-0 text-muted-foreground"
                }
              />
              <span
                className={
                  step.done ? "text-muted-foreground line-through" : ""
                }
              >
                {step.label}
                {step.done ? <span className="sr-only"> (fait)</span> : null}
              </span>
              {step.optional ? (
                <span className="text-sm text-muted-foreground">
                  facultatif
                </span>
              ) : null}
              {step.href ? (
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto size-5 shrink-0 text-muted-foreground"
                />
              ) : null}
            </>
          );
          return (
            <li key={step.label}>
              {step.href ? (
                <Link
                  href={step.href}
                  className="flex min-h-12 items-center gap-3 py-2 hover:text-primary"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex min-h-12 items-center gap-3 py-2">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
