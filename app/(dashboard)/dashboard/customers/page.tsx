import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Phone, Plus, Users } from "lucide-react";

import { ListToolbar } from "@/components/dashboard/list-toolbar";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { searchCustomers } from "@/features/customers/queries";
import { formatPhone } from "@/lib/phone";
import { can } from "@/lib/permissions/roles";

export const metadata: Metadata = { title: "Clients" };

export default async function CustomersPage({
  searchParams,
}: PageProps<"/dashboard/customers">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const archived = params.archives === "1";
  const cursor = typeof params.apres === "string" ? params.apres : undefined;

  const business = await requireActiveBusiness();
  const canWrite = can(business.role, "customers.write");
  const { customers, nextCursor } = await searchCustomers(business.id, {
    query,
    archived,
    cursor,
  });

  const nextParams = new URLSearchParams();
  if (query) nextParams.set("q", query);
  if (archived) nextParams.set("archives", "1");
  if (nextCursor) nextParams.set("apres", nextCursor);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Clients"
          description="Vos clients et leur historique."
        />
        {canWrite ? (
          <Button asChild className="shrink-0">
            <Link href="/dashboard/customers/new">
              <Plus aria-hidden="true" />
              Nouveau
            </Link>
          </Button>
        ) : null}
      </div>
      <ListToolbar
        basePath="/dashboard/customers"
        query={query}
        archived={archived}
        searchLabel="Nom ou téléphone"
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            query
              ? "Aucun client trouvé"
              : archived
                ? "Aucun client archivé"
                : "Aucun client"
          }
          description={
            query
              ? "Vérifiez l'orthographe ou cherchez avec quelques chiffres du numéro."
              : "Ajoutez un client avec un nom et, si vous voulez, un numéro de téléphone. Vous verrez ses commandes et son solde."
          }
          action={
            canWrite && !query && !archived ? (
              <Button asChild>
                <Link href="/dashboard/customers/new">Ajouter un client</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="divide-y rounded-xl border bg-card"
          aria-label="Liste des clients"
        >
          {customers.map((customer) => (
            <li key={customer.id} className="flex items-center">
              <Link
                href={`/dashboard/customers/${customer.id}`}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 hover:bg-accent"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{customer.name}</span>
                  {customer.phone_e164 ? (
                    <span className="text-sm text-muted-foreground">
                      {formatPhone(customer.phone_e164)}
                    </span>
                  ) : null}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="ml-auto size-5 shrink-0 text-muted-foreground"
                />
              </Link>
              {customer.phone_e164 ? (
                <a
                  href={`tel:${customer.phone_e164}`}
                  className="flex size-14 shrink-0 items-center justify-center border-l text-primary"
                  aria-label={`Appeler ${customer.name}`}
                >
                  <Phone aria-hidden="true" className="size-5" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href={`/dashboard/customers?${nextParams}`}>
              Voir la suite
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
