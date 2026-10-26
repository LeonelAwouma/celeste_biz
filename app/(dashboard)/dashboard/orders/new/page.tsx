import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { OrderForm } from "@/components/orders/order-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { getCustomer } from "@/features/customers/queries";
import { loadOrderFormData } from "@/features/orders/form-data";
import { visibleOrderFields } from "@/features/orders/schemas";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Nouvelle commande" };

export default async function NewOrderPage({
  searchParams,
}: PageProps<"/dashboard/orders/new">) {
  const params = await searchParams;
  const { business, template, modules } = await getBusinessContext();

  if (!can(business.role, "orders.write")) {
    return (
      <>
        <PageHeader title="Nouvelle commande" />
        <EmptyState
          title="Action non autorisée"
          description="Votre rôle permet de consulter les commandes, pas d'en créer."
        />
      </>
    );
  }

  const [{ catalog, members }, customer] = await Promise.all([
    loadOrderFormData(business.id),
    typeof params.client === "string"
      ? getCustomer(business.id, params.client)
      : null,
  ]);

  return (
    <>
      <PageHeader
        title="Nouvelle commande"
        description={template.labels.order}
      />
      <OrderForm
        mode="create"
        orderLabel="Délai et informations"
        initialCustomer={
          customer && !customer.archived_at
            ? {
                id: customer.id,
                name: customer.name,
                phone: customer.phone_e164,
              }
            : null
        }
        catalog={catalog}
        members={members}
        fields={visibleOrderFields(template, modules)}
      />
    </>
  );
}
