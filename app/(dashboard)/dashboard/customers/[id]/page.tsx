import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { setCustomerArchived } from "@/features/customers/actions";
import { getCustomer } from "@/features/customers/queries";
import { formatPhone } from "@/lib/phone";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Fiche client" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeZone: "Africa/Douala",
});

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/dashboard/customers/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const business = await requireActiveBusiness();
  const customer = await getCustomer(business.id, id);
  if (!customer) notFound();

  const canWrite =
    can(business.role, "customers.write") && !customer.archived_at;
  const canArchive = can(business.role, "customers.archive");

  return (
    <>
      <Link
        href="/dashboard/customers"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Clients
      </Link>
      <PageHeader
        title={customer.name}
        description={
          customer.archived_at
            ? `Archivé le ${dateFormat.format(new Date(customer.archived_at))}`
            : customer.phone_e164
              ? formatPhone(customer.phone_e164)
              : "Sans téléphone"
        }
      />
      {query.enregistre === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Client enregistré.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="historique">
          <h2 id="historique" className="mb-2 text-lg font-semibold">
            Historique
          </h2>
          <EmptyState
            icon={ClipboardList}
            title="Aucune commande pour l'instant"
            description="Les commandes, devis, paiements et le solde de ce client apparaîtront ici."
          />
        </section>

        <section aria-labelledby="informations">
          <h2 id="informations" className="mb-2 text-lg font-semibold">
            Informations
          </h2>
          <CustomerForm
            mode="edit"
            readOnly={!canWrite}
            customer={{
              id: customer.id,
              name: customer.name,
              phone: customer.phone_e164
                ? formatPhone(customer.phone_e164)
                : "",
              email: customer.email ?? "",
              notes: customer.notes ?? "",
              marketingConsent: customer.marketing_consent,
              marketingConsentAt: customer.marketing_consent_at,
            }}
          />
        </section>

        {canArchive ? (
          <ConfirmActionForm
            action={setCustomerArchived}
            hidden={{
              id: customer.id,
              archive: customer.archived_at ? "0" : "1",
            }}
            confirmMessage={
              customer.archived_at
                ? `Restaurer ${customer.name} dans la liste des clients actifs ?`
                : `Archiver ${customer.name} ? Le client disparaîtra de la liste active ; son historique est conservé.`
            }
          >
            {customer.archived_at
              ? "Restaurer le client"
              : "Archiver le client"}
          </ConfirmActionForm>
        ) : null}
      </div>
    </>
  );
}
