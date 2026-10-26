import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { QuoteForm } from "@/components/quotes/quote-form";
import { getBusinessContext } from "@/features/businesses/active-business";
import { loadOrderFormData } from "@/features/orders/form-data";
import { getQuote } from "@/features/quotes/queries";
import { toInputAmount } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Modifier le devis" };

export default async function EditQuotePage({
  params,
}: PageProps<"/dashboard/quotes/[id]/edit">) {
  const { id } = await params;
  const { business } = await getBusinessContext();
  const quote = await getQuote(business.id, id);
  if (!quote) notFound();

  const back = (
    <Link
      href={`/dashboard/quotes/${quote.id}`}
      className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {quote.code}
    </Link>
  );

  if (!can(business.role, "orders.write") || quote.status !== "draft") {
    return (
      <>
        {back}
        <PageHeader title="Modifier le devis" />
        <EmptyState
          title="Modification impossible"
          description={
            quote.status !== "draft"
              ? "Seul un devis en brouillon se modifie. Repassez-le en brouillon depuis sa fiche."
              : "Votre rôle permet de consulter les devis, pas de les modifier."
          }
        />
      </>
    );
  }

  const { catalog } = await loadOrderFormData(business.id);
  return (
    <>
      {back}
      <PageHeader title={`Modifier ${quote.code}`} />
      <QuoteForm
        mode="edit"
        catalog={catalog}
        defaultValidUntil=""
        initial={{
          id: quote.id,
          version: quote.version,
          customer: quote.customer,
          lines: quote.items.map((item) => ({
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
          validUntil: quote.validUntil ?? "",
          conditions: quote.conditions ?? "",
          notes: quote.notes ?? "",
        }}
      />
    </>
  );
}
