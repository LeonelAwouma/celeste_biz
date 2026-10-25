import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OPTIONAL_MODULE_INFO } from "@/features/professions/registry";
import {
  OPTIONAL_MODULES,
  type ModuleKey,
  type ProfessionTemplate,
} from "@/features/professions/schema";

/** Ce que le profil métier configure, expliqué sans jargon. */
export function ProfessionSummary({
  template,
  modules,
}: {
  template: ProfessionTemplate;
  modules: Set<ModuleKey>;
}) {
  const activeOptional = OPTIONAL_MODULES.filter(
    (module) =>
      template.availableModules.includes(module) && modules.has(module),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="text-lg">Configuré pour : {template.label}</span>
        </CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <h3 className="mb-1 font-medium">
            Informations demandées à chaque commande
          </h3>
          <ul className="flex flex-wrap gap-2" aria-label="Champs de commande">
            {template.orderFields.map((field) => (
              <li
                key={field.key}
                className="rounded-full bg-secondary px-3 py-1 text-secondary-foreground"
              >
                {field.label}
                {field.private ? " (privé)" : ""}
              </li>
            ))}
          </ul>
        </div>
        {template.productionSteps.length ? (
          <div>
            <h3 className="mb-1 font-medium">Étapes de réalisation</h3>
            <p className="text-muted-foreground">
              {template.productionSteps.map((step) => step.label).join(" → ")}
            </p>
          </div>
        ) : null}
        <div>
          <h3 className="mb-1 font-medium">Modules activés</h3>
          <p className="text-muted-foreground">
            Commandes, clients, catalogue, encaissements, factures
            {activeOptional
              .map((m) => `, ${OPTIONAL_MODULE_INFO[m].label.toLowerCase()}`)
              .join("")}
            .{" "}
            <Link
              href="/dashboard/settings#modules"
              className="text-primary underline-offset-4 hover:underline"
            >
              Modifier
            </Link>
          </p>
        </div>
      </div>
    </Card>
  );
}
