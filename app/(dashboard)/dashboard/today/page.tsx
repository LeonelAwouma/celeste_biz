import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { GettingStarted } from "@/components/today/getting-started";
import { ProfessionSummary } from "@/components/today/profession-summary";
import { getBusinessContext } from "@/features/businesses/active-business";

export const metadata: Metadata = { title: "Aujourd'hui" };

export default async function TodayPage() {
  const context = await getBusinessContext();

  return (
    <>
      <PageHeader
        title="Aujourd'hui"
        description={`Bienvenue dans l'espace de ${context.business.name}.`}
      />
      <div className="flex flex-col gap-4">
        <GettingStarted context={context} />
        <ProfessionSummary
          template={context.template}
          modules={context.modules}
        />
      </div>
    </>
  );
}
