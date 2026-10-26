import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, MessageCircle, Pencil } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { LinesSummary } from "@/components/documents/lines-summary";
import { Notice } from "@/components/documents/notice";
import {
  ConvertQuoteForm,
  QuoteActions,
} from "@/components/quotes/quote-actions";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listMembers } from "@/features/businesses/team";
import { getQuote } from "@/features/quotes/queries";
import {
  availableQuoteActions,
  isQuoteExpired,
} from "@/features/quotes/status";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime, todayLocal } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Devis" };

export default async function QuotePage({
  params,
  searchParams,
}: PageProps<"/dashboard/quotes/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { business } = await getBusinessContext();
  const [quote, members] = await Promise.all([
    getQuote(business.id, id),
    listMembers(business.id),
  ]);
  if (!quote) notFound();

  const names = new Map(members.map((m) => [m.userId, m.displayName]));
  const canWrite = can(business.role, "orders.write");
  const expired =
    quote.status === "sent" && isQuoteExpired(quote.validUntil, todayLocal());
  const actions = availableQuoteActions(quote.status, business.role).filter(
    // Devis dont la validité est dépassée : plus d'acceptation possible.
    (action) => !(expired && action.to === "accepted"),
  );
  const shareText = [
    `Bonjour ${quote.customer.name},`,
    `voici notre devis ${quote.code} : ${formatXaf(quote.total)}`,
    quote.validUntil
      ? `, valable jusqu'au ${formatDate(quote.validUntil)}.`
      : ".",
    ` ${business.name}`,
  ].join("");

  return (
    <>
      <Link
        href="/dashboard/quotes"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Devis
      </Link>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={quote.code} description="Devis" />
        <QuoteStatusBadge status={quote.status} className="mt-2" />
      </div>

      <div className="flex flex-col gap-6">
        {query.enregistre === "1" ? (
          <Notice>Devis enregistré en brouillon.</Notice>
        ) : query.modifie === "1" ? (
          <Notice>Modifications enregistrées.</Notice>
        ) : null}
        {expired ? (
          <Notice tone="warning">
            La date de validité est dépassée. Repassez le devis en brouillon
            pour l&apos;actualiser, ou marquez-le comme expiré.
          </Notice>
        ) : null}

        <section
          aria-label="Client"
          className="flex flex-col rounded-xl border bg-card px-4 py-3"
        >
          <Link
            href={`/dashboard/customers/${quote.customer.id}`}
            className="truncate font-medium text-primary"
          >
            {quote.customer.name}
          </Link>
          {quote.customer.phone ? (
            <span className="text-sm text-muted-foreground">
              {formatPhone(quote.customer.phone)}
            </span>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline">
            <a
              href={`/dashboard/quotes/${quote.id}/pdf`}
              target="_blank"
              rel="noopener"
            >
              <FileDown aria-hidden="true" />
              PDF
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href={whatsappLink(quote.customer.phone, shareText)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              WhatsApp
            </a>
          </Button>
        </div>
        <p className="-mt-4 text-xs text-muted-foreground">
          WhatsApp s&apos;ouvre avec un message prêt à envoyer ; joignez-y le
          PDF téléchargé.
        </p>

        {quote.orderId ? (
          <Notice>
            Commande créée à partir de ce devis :{" "}
            <Link
              href={`/dashboard/orders/${quote.orderId}`}
              className="font-medium underline"
            >
              {quote.orderCode}
            </Link>
          </Notice>
        ) : null}

        <QuoteActions
          quoteId={quote.id}
          version={quote.version}
          actions={actions}
        />
        {quote.status === "accepted" && !quote.orderId && canWrite ? (
          <ConvertQuoteForm quoteId={quote.id} />
        ) : null}

        <section aria-labelledby="lignes" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="lignes" className="text-lg font-semibold">
              Détail
            </h2>
            {canWrite && quote.status === "draft" ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/quotes/${quote.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Modifier
                </Link>
              </Button>
            ) : null}
          </div>
          <LinesSummary
            items={quote.items}
            subtotal={quote.subtotal}
            taxTotal={quote.taxTotal}
            total={quote.total}
            label="Lignes du devis"
          />
        </section>

        <dl className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-muted-foreground">
              Valable jusqu&apos;au
            </dt>
            <dd>
              {quote.validUntil ? formatDate(quote.validUntil) : "Non précisé"}
            </dd>
          </div>
          {quote.conditions ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Conditions</dt>
              <dd className="whitespace-pre-line">{quote.conditions}</dd>
            </div>
          ) : null}
          {quote.sentAt ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Envoyé</dt>
              <dd>{formatDateTime(quote.sentAt)}</dd>
            </div>
          ) : null}
          {quote.decidedAt &&
          quote.status !== "draft" &&
          quote.status !== "sent" ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Décision</dt>
              <dd data-testid="quote-decision">
                {quote.status === "accepted"
                  ? "Acceptation déclarée manuellement"
                  : quote.status === "rejected"
                    ? "Refus enregistré"
                    : quote.status === "expired"
                      ? "Marqué comme expiré"
                      : "Annulé"}
                {quote.decidedBy
                  ? ` par ${names.get(quote.decidedBy) ?? "un ancien membre"}`
                  : ""}
                {` · ${formatDateTime(quote.decidedAt)}`}
                {quote.decisionNote ? ` — ${quote.decisionNote}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
        {quote.notes ? (
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <p className="font-medium">Notes internes</p>
            <p className="whitespace-pre-line">{quote.notes}</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
