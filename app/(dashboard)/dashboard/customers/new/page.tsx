import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Nouveau client" };

export default async function NewCustomerPage() {
  const business = await requireActiveBusiness();

  return (
    <>
      <PageHeader title="Nouveau client" />
      {can(business.role, "customers.write") ? (
        <CustomerForm mode="create" />
      ) : (
        <EmptyState
          title="Action non autorisée"
          description="Votre rôle permet de consulter les clients, pas d'en ajouter."
        />
      )}
    </>
  );
}
