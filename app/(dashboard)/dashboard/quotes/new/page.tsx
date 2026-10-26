import type { Metadata } from "next";

import { ModuleDisabled } from "@/components/dashboard/module-disabled";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { QuoteForm } from "@/components/quotes/quote-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { getCustomer } from "@/features/customers/queries";
import { loadOrderFormData } from "@/features/orders/form-data";
import { can } from "@/lib/permissions/roles";
import { addDays, todayLocal } from "@/lib/time";

export const metadata: Metadata = { title: "Nouveau devis" };

export default async function NewQuotePage({
  searchParams,
}: PageProps<"/dashboard/quotes/new">) {
  const params = await searchParams;
  const { business, modules } = await getBusinessContext();

  if (!modules.has("quotes")) {
    return (
      <>
        <PageHeader title="Nouveau devis" />
        <ModuleDisabled label="Devis" />
      </>
    );
  }
  if (!can(business.role, "orders.write")) {
    return (
      <>
        <PageHeader title="Nouveau devis" />
        <EmptyState
          title="Action non autorisée"
          description="Votre rôle permet de consulter les devis, pas d'en créer."
        />
      </>
    );
  }

  const [{ catalog }, customer] = await Promise.all([
    loadOrderFormData(business.id),
    typeof params.client === "string"
      ? getCustomer(business.id, params.client)
      : null,
  ]);

  return (
    <>
      <PageHeader
        title="Nouveau devis"
        description="Une proposition de prix, à transformer en commande si le client accepte."
      />
      <QuoteForm
        mode="create"
        catalog={catalog}
        defaultValidUntil={addDays(todayLocal(), 15)}
        initialCustomer={
          customer && !customer.archived_at
            ? {
                id: customer.id,
                name: customer.name,
                phone: customer.phone_e164,
              }
            : null
        }
      />
    </>
  );
}
