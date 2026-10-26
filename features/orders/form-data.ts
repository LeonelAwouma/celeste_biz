import "server-only";

import type { CatalogOption } from "@/components/orders/order-form";
import { listMembers } from "@/features/businesses/team";
import { listCatalogItems } from "@/features/catalog/queries";

import { toAmount } from "./queries";

/** Données du formulaire de commande : catalogue actif et équipe. */
export async function loadOrderFormData(businessId: string) {
  const [items, members] = await Promise.all([
    listCatalogItems(businessId, { withImages: false }),
    listMembers(businessId),
  ]);
  const catalog: CatalogOption[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    category: item.category,
    priceMode: item.price_mode,
    price: item.price === null ? null : toAmount(item.price),
  }));
  return {
    catalog,
    members: members
      .filter((member) => member.role !== "viewer")
      .map((member) => ({
        userId: member.userId,
        displayName: member.displayName,
      })),
  };
}
