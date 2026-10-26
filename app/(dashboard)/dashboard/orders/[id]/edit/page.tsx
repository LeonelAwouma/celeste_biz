import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { detailsToFormValues } from "@/components/orders/order-detail-fields";
import { OrderForm } from "@/components/orders/order-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { loadOrderFormData } from "@/features/orders/form-data";
import { getOrder } from "@/features/orders/queries";
import { visibleOrderFields } from "@/features/orders/schemas";
import { isTerminal, itemsEditable } from "@/features/orders/status";
import { getProfessionTemplate } from "@/features/professions/registry";
import { toInputAmount } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { isoToLocalParts } from "@/lib/time";

export const metadata: Metadata = { title: "Modifier la commande" };

export default async function EditOrderPage({
  params,
}: PageProps<"/dashboard/orders/[id]/edit">) {
  const { id } = await params;
  const { business, modules } = await getBusinessContext();
  const order = await getOrder(business.id, id);
  if (!order) notFound();

  const back = (
    <Link
      href={`/dashboard/orders/${order.id}`}
      className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {order.code}
    </Link>
  );

  if (!can(business.role, "orders.write") || isTerminal(order.status)) {
    return (
      <>
        {back}
        <PageHeader title="Modifier la commande" />
        <EmptyState
          title="Modification impossible"
          description={
            isTerminal(order.status)
              ? "Une commande clôturée ou annulée ne se modifie plus."
              : "Votre rôle permet de consulter les commandes, pas de les modifier."
          }
        />
      </>
    );
  }

  const template = getProfessionTemplate(
    order.professionKey,
    order.professionVersion,
  );
  const fields = visibleOrderFields(template, modules);
  const { catalog, members } = await loadOrderFormData(business.id);
  const due = order.dueAt
    ? isoToLocalParts(order.dueAt)
    : { date: "", time: "" };

  return (
    <>
      {back}
      <PageHeader title={`Modifier ${order.code}`} />
      <OrderForm
        mode="edit"
        orderLabel="Délai et informations"
        itemsLocked={!itemsEditable(order.status)}
        catalog={catalog}
        members={members}
        fields={fields}
        productionSteps={
          order.status === "in_progress" ? template.productionSteps : []
        }
        initial={{
          id: order.id,
          version: order.version,
          customer: order.customer,
          lines: order.items.map((item) => ({
            catalogItemId: item.catalogItemId,
            name: item.name,
            unit: item.unit ?? "",
            quantity: item.quantity.replace(".", ","),
            unitPrice: toInputAmount(item.unitPrice),
            discount:
              Number(item.discount) > 0 ? toInputAmount(item.discount) : "",
            taxRate:
              Number(item.taxRate) > 0 ? item.taxRate.replace(".", ",") : "",
          })),
          dueDate: due.date,
          dueTime: due.time === "18:00" ? "" : due.time,
          assigneeId: order.assigneeId ?? "",
          notes: order.notes ?? "",
          productionStep: order.productionStep ?? "",
          details: detailsToFormValues(fields, order.details),
        }}
      />
    </>
  );
}
