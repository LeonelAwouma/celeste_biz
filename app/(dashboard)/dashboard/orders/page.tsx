import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, Plus, Search } from "lucide-react";

import { NEW_ORDER_HREF } from "@/components/dashboard/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  isOrderFilter,
  listOrders,
  type OrderFilter,
} from "@/features/orders/queries";
import { isLate } from "@/features/orders/status";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Commandes" };

const FILTERS: { key: OrderFilter; label: string }[] = [
  { key: "active", label: "En cours" },
  { key: "late", label: "En retard" },
  { key: "to_collect", label: "À encaisser" },
  { key: "draft", label: "Brouillons" },
  { key: "done", label: "Terminées" },
];

const EMPTY: Record<OrderFilter, { title: string; description: string }> = {
  active: {
    title: "Aucune commande en cours",
    description:
      "Enregistrez une commande reçue à l'atelier, par téléphone ou sur WhatsApp : vous retrouverez ici son état, son délai et son solde.",
  },
  late: {
    title: "Aucune commande en retard",
    description: "Toutes les échéances sont tenues.",
  },
  to_collect: {
    title: "Rien à encaisser",
    description: "Aucune commande n'a de solde restant.",
  },
  draft: {
    title: "Aucun brouillon",
    description: "Les commandes enregistrées comme brouillon apparaissent ici.",
  },
  done: {
    title: "Aucune commande terminée",
    description:
      "Les commandes livrées, clôturées ou annulées apparaissent ici.",
  },
  all: { title: "Aucune commande", description: "" },
};

export default async function OrdersPage({
  searchParams,
}: PageProps<"/dashboard/orders">) {
  const params = await searchParams;
  const filter = isOrderFilter(params.filtre) ? params.filtre : "active";
  const query =
    typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const cursor = typeof params.apres === "string" ? params.apres : undefined;

  const { business, template } = await getBusinessContext();
  const canWrite = can(business.role, "orders.write");
  const { orders, nextCursor } = await listOrders(business.id, {
    filter,
    query,
    cursor,
  });

  const href = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({
      filtre: filter,
      q: query || undefined,
      ...next,
    })) {
      if (value && !(key === "filtre" && value === "active"))
        search.set(key, value);
    }
    return search.size ? `/dashboard/orders?${search}` : "/dashboard/orders";
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title={template.labels.orders}
          description="Suivi des délais, des états et des soldes."
        />
        {canWrite ? (
          <Button asChild className="shrink-0">
            <Link href={NEW_ORDER_HREF}>
              <Plus aria-hidden="true" />
              Nouvelle
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <form role="search" action="/dashboard/orders" className="flex gap-2">
          {filter !== "active" ? (
            <input type="hidden" name="filtre" value={filter} />
          ) : null}
          <label htmlFor="q" className="sr-only">
            Numéro ou client
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Numéro (CMD-…) ou client"
            enterKeyHint="search"
            maxLength={100}
          />
          <Button
            type="submit"
            variant="outline"
            size="icon"
            aria-label="Rechercher"
          >
            <Search aria-hidden="true" />
          </Button>
        </form>
        <nav
          aria-label="Filtre des commandes"
          className="-mx-4 flex gap-1 overflow-x-auto px-4"
        >
          {FILTERS.map((entry) => (
            <Link
              key={entry.key}
              href={href({ filtre: entry.key, apres: undefined })}
              aria-current={entry.key === filter ? "page" : undefined}
              className={cn(
                "flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground",
                entry.key === filter && "bg-accent text-accent-foreground",
              )}
            >
              {entry.label}
            </Link>
          ))}
        </nav>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={query ? "Aucune commande trouvée" : EMPTY[filter].title}
          description={
            query
              ? "Vérifiez le numéro ou le nom du client."
              : EMPTY[filter].description
          }
          action={
            canWrite && filter === "active" && !query ? (
              <Button asChild>
                <Link href={NEW_ORDER_HREF}>Nouvelle commande</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="divide-y rounded-xl border bg-card"
          aria-label="Liste des commandes"
        >
          {orders.map((order) => {
            const late = isLate(order.dueAt, order.status);
            return (
              <li key={order.id}>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {order.customerName}
                      </span>
                      <StatusBadge status={order.status} template={template} />
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {order.code}
                      {order.dueAt ? (
                        <span
                          className={cn(late && "font-medium text-destructive")}
                        >
                          {" · "}
                          {late ? "En retard : " : "Pour "}
                          {formatDateTime(order.dueAt)}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end text-sm">
                    <span className="font-medium">
                      {formatXaf(order.total)}
                    </span>
                    {Number(order.balance) > 0 &&
                    order.status !== "cancelled" ? (
                      <span className="text-muted-foreground">
                        Reste {formatXaf(order.balance)}
                      </span>
                    ) : order.status !== "cancelled" &&
                      order.status !== "draft" ? (
                      <span className="text-success-foreground">Soldée</span>
                    ) : null}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="size-5 shrink-0 text-muted-foreground"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {nextCursor ? (
        <div className="mt-4 flex justify-center">
          <Button asChild variant="outline">
            <Link href={href({ apres: nextCursor })}>Voir la suite</Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
