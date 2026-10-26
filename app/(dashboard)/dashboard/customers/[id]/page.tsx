import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  MessageCircle,
  Phone,
  Plus,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { CustomerForm } from "@/components/customers/customer-form";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmActionForm } from "@/components/forms/confirm-action-form";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { setCustomerArchived } from "@/features/customers/actions";
import { getCustomer } from "@/features/customers/queries";
import { getCustomerBalance, listOrders } from "@/features/orders/queries";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatPhone } from "@/lib/phone";
import { can } from "@/lib/permissions/roles";
import { whatsappLink } from "@/lib/whatsapp";

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
  const { business, template } = await getBusinessContext();
  const customer = await getCustomer(business.id, id);
  if (!customer) notFound();
  const [{ orders }, balance] = await Promise.all([
    listOrders(business.id, {
      filter: "all",
      customerId: customer.id,
      limit: 10,
    }),
    getCustomerBalance(business.id, customer.id),
  ]);

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
      {customer.phone_e164 && !customer.archived_at ? (
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <a
              href={whatsappLink(
                customer.phone_e164,
                `Bonjour ${customer.name}, `,
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`tel:${customer.phone_e164}`}>
              <Phone aria-hidden="true" />
              Appeler
            </a>
          </Button>
        </div>
      ) : null}
      {query.enregistre === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Client enregistré.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <section aria-labelledby="historique" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="historique" className="text-lg font-semibold">
              Commandes
            </h2>
            {can(business.role, "orders.write") && !customer.archived_at ? (
              <Button asChild size="sm">
                <Link href={`/dashboard/orders/new?client=${customer.id}`}>
                  <Plus aria-hidden="true" />
                  Nouvelle commande
                </Link>
              </Button>
            ) : null}
          </div>
          {Number(balance.balance) > 0 ? (
            <p className="rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
              Reste à payer sur ses commandes :{" "}
              <strong>{formatXaf(balance.balance)}</strong>
            </p>
          ) : null}
          {orders.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="Aucune commande pour l'instant"
              description="Les commandes, paiements et le solde de ce client apparaîtront ici."
            />
          ) : (
            <ul
              className="divide-y rounded-xl border bg-card"
              aria-label="Commandes du client"
            >
              {orders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/dashboard/orders/${order.id}`}
                    className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2 font-medium">
                        {order.code}
                        <StatusBadge
                          status={order.status}
                          template={template}
                        />
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatXaf(order.total)}
                        {Number(order.balance) > 0 &&
                        order.status !== "cancelled"
                          ? ` · reste ${formatXaf(order.balance)}`
                          : ""}
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {balance.count > orders.length ? (
            <p className="text-sm text-muted-foreground">
              {orders.length} commandes les plus récentes sur {balance.count}.
            </p>
          ) : null}
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
