import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Notice } from "@/components/documents/notice";
import { EmptyState } from "@/components/feedback/empty-state";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  isIssueEnabledInDatabase,
  listInvoices,
} from "@/features/invoices/queries";
import { isFiscalInvoiceIssueEnabled } from "@/lib/env";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Factures" };

export default async function InvoicesPage({
  searchParams,
}: PageProps<"/dashboard/invoices">) {
  const params = await searchParams;
  const cursor = typeof params.apres === "string" ? params.apres : undefined;
  const { business } = await getBusinessContext();
  const [{ invoices, nextCursor }, dbEnabled] = await Promise.all([
    listInvoices(business.id, { cursor }),
    isIssueEnabledInDatabase(),
  ]);
  const issueEnabled = dbEnabled && isFiscalInvoiceIssueEnabled();

  return (
    <>
      <PageHeader
        title="Factures"
        description="Brouillons préparés depuis vos commandes et factures émises."
      />
      {!issueEnabled ? (
        <Notice tone="warning" className="mb-4">
          Émission définitive désactivée : la conformité fiscale n&apos;est pas
          encore validée. Les brouillons restent disponibles, marqués comme
          tels.
        </Notice>
      ) : null}

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Aucune facture"
          description="Ouvrez une commande puis « Préparer une facture » : un brouillon reprend ses lignes et reste modifiable jusqu'à l'émission."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/orders">Voir les commandes</Link>
            </Button>
          }
        />
      ) : (
        <ul
          className="divide-y rounded-xl border bg-card"
          aria-label="Liste des factures"
        >
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/dashboard/invoices/${invoice.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-medium">
                    {invoice.customerName}
                  </span>
                  <InvoiceStatusBadge
                    status={invoice.status}
                    className="self-start"
                  />
                  <span className="text-sm text-muted-foreground">
                    {invoice.number ?? "Sans numéro (brouillon)"}
                    {invoice.orderCode ? ` · ${invoice.orderCode}` : ""}
                    {invoice.issueDate
                      ? ` · ${formatDate(invoice.issueDate)}`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium">
                  {formatXaf(invoice.total)}
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
            <Link href={`/dashboard/invoices?apres=${nextCursor}`}>
              Voir la suite
            </Link>
          </Button>
        </div>
      ) : null}
    </>
  );
}
