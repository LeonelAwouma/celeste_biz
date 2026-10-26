import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { CatalogItemForm } from "@/components/catalog/catalog-item-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listCategories } from "@/features/catalog/queries";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Nouvel article" };

export default async function NewCatalogItemPage() {
  const { business, template } = await getBusinessContext();

  if (!can(business.role, "catalog.write")) {
    return (
      <>
        <PageHeader
          title={`Nouveau : ${template.labels.catalogItem.toLowerCase()}`}
        />
        <EmptyState
          title="Action non autorisée"
          description="Seuls le propriétaire et le gestionnaire modifient le catalogue."
        />
      </>
    );
  }

  const categories = await listCategories(business.id);
  return (
    <>
      <PageHeader
        title={`Nouveau : ${template.labels.catalogItem.toLowerCase()}`}
      />
      <CatalogItemForm
        mode="create"
        categories={categories}
        defaultKind={template.key === "catering" ? "product" : "service"}
      />
    </>
  );
}
