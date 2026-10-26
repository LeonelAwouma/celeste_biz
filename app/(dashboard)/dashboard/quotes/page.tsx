import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileText, Plus } from "lucide-react";

import { ModuleDisabled } from "@/components/dashboard/module-disabled";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  isQuoteFilter,
  listQuotes,
  type QuoteFilter,
} from "@/features/quotes/queries";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Devis" };

const FILTERS: { key: QuoteFilter; label: string }[] = [
  { key: "open", label: "En cours" },
  { key: "accepted", label: "Acceptés" },
  { key: "closed", label: "Refusés ou expirés" },
  { key: "all", label: "Tous" },
];

const EMPTY: Record<QuoteFilter, string> = {
  open: "Préparez un devis, envoyez-le à votre client et transformez-le en commande quand il est accepté.",
  accepted: "Les devis acceptés par vos clients apparaissent ici.",
  closed: "Les devis refusés, expirés ou annulés apparaissent ici.",
  all: "Préparez votre premier devis.",
};

export default async function QuotesPage({
  searchParams,
}: PageProps<"/dashboard/quotes">) {
  const params = await searchParams;
  const { business, modules } = await getBusinessContext();

  if (!modules.has("quotes")) {
    return (
      <>
        <PageHeader title="Devis" />
        <ModuleDisabled label="Devis" />
      </>
    );
  }

  const filter = isQuoteFilter(params.filtre) ? params.filtre : "open";
  const cursor = typeof params.apres === "string" ? params.apres : undefined;
  const canWrite = can(business.role, "orders.write");
  const { quotes, nextCursor } = await listQuotes(business.id, {
    filter,
    cursor,
  });
  const href = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries({ filtre: filter, ...next })) {
      if (value && !(key === "filtre" && value === "open"))
        search.set(key, value);
    }
    return search.size ? `/dashboard/quotes?${search}` : "/dashboard/quotes";
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Devis"
          description="Vos propositions de prix et la réponse de vos clients."
        />
        {canWrite ? (
          <Button asChild className="shrink-0">
            <Link href="/dashboard/quotes/new">
              <Plus aria-hidden="true" />
              Nouveau
            </Link>
          </Button>
        ) : null}
      </div>

      <nav
        aria-label="Filtre des devis"
        className="-mx-4 mb-4 flex gap-1 overflow-x-auto px-4"
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

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis"
          description={EMPTY[filter]}
          action={
            canWrite && filter === "open" ? (
              <Button asChild>
                <Link href="/dashboard/quotes/new">Nouveau devis</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul
          className="divide-y rounded-xl border bg-card"
          aria-label="Liste des devis"
        >
          {quotes.map((quote) => (
            <li key={quote.id}>
              <Link
                href={`/dashboard/quotes/${quote.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">
                    {quote.customerName}
                  </span>
                  <QuoteStatusBadge
                    status={quote.status}
                    className="self-start"
                  />
                  <span className="text-sm text-muted-foreground">
                    {quote.code}
                    {quote.validUntil && quote.status === "sent"
                      ? ` · valable jusqu'au ${formatDate(quote.validUntil)}`
                      : ""}
                    {quote.orderId ? " · commande créée" : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium">
                  {formatXaf(quote.total)}
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
