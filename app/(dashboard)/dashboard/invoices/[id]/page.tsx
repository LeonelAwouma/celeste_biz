import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { LinesSummary } from "@/components/documents/lines-summary";
import { Notice } from "@/components/documents/notice";
import {
  CreditNoteForm,
  DiscardInvoiceForm,
  InvoiceDraftForm,
  IssueInvoiceForm,
} from "@/components/invoices/invoice-forms";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import {
  getInvoice,
  getSellerProfile,
  isIssueEnabledInDatabase,
} from "@/features/invoices/queries";
import { isFiscalInvoiceIssueEnabled } from "@/lib/env";
import { subtractAmounts, sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatDate, formatDateTime } from "@/lib/time";
import { whatsappLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Facture" };

export default async function InvoicePage({
  params,
  searchParams,
}: PageProps<"/dashboard/invoices/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { business } = await getBusinessContext();
  const [invoice, seller, dbEnabled] = await Promise.all([
    getInvoice(business.id, id),
    getSellerProfile(business.id),
    isIssueEnabledInDatabase(),
  ]);
  if (!invoice || invoice.status === "discarded") notFound();

  const canWrite = can(business.role, "invoices.write");
  const issueEnabled = dbEnabled && isFiscalInvoiceIssueEnabled();
  const draft = invoice.status === "draft";
  const credited = sumAmounts(invoice.creditNotes.map((note) => note.amount));
  const remaining = subtractAmounts(invoice.total, credited);

  return (
    <>
      <Link
        href={
          invoice.order
            ? `/dashboard/orders/${invoice.order.id}`
            : "/dashboard/invoices"
        }
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {invoice.order ? invoice.order.code : "Factures"}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title={invoice.number ?? "Brouillon de facture"}
          description={invoice.customer.name}
        />
        <InvoiceStatusBadge status={invoice.status} className="mt-2" />
      </div>

      <div className="flex flex-col gap-6">
        {query.emise === "1" ? (
          <Notice>Facture émise avec le numéro {invoice.number}.</Notice>
        ) : query.avoir === "1" ? (
          <Notice>Avoir émis.</Notice>
        ) : null}
        {draft ? (
          <Notice tone="warning">
            Brouillon : sans numéro et sans valeur de facture. Le PDF porte la
            mention « Brouillon — non valable comme facture ».
          </Notice>
        ) : (
          <Notice>
            Facture émise le {formatDate(invoice.issueDate!)} : elle ne peut
            plus être modifiée. Une correction passe par un avoir.
          </Notice>
        )}

        <Button asChild variant="outline">
          <a
            href={`/dashboard/invoices/${invoice.id}/pdf`}
            target="_blank"
            rel="noopener"
          >
            <FileDown aria-hidden="true" />
            {draft ? "PDF du brouillon" : "PDF de la facture"}
          </a>
        </Button>
        {!draft ? (
          <div className="-mt-3 flex flex-col gap-1">
            <Button asChild variant="outline">
              <a
                href={whatsappLink(
                  invoice.customer.phone,
                  `Bonjour ${invoice.customer.name}, voici votre facture ${invoice.number} de ${formatXaf(invoice.total)}. Je vous l'envoie en PDF juste après ce message.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                Envoyer par WhatsApp
              </a>
            </Button>
            <p className="text-xs text-muted-foreground">
              WhatsApp s&apos;ouvre avec un message prêt ; joignez-y le PDF
              téléchargé.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="lignes" className="flex flex-col gap-2">
          <h2 id="lignes" className="text-lg font-semibold">
            Détail
          </h2>
          <LinesSummary
            items={invoice.items}
            subtotal={invoice.subtotal}
            taxTotal={invoice.taxTotal}
            total={invoice.total}
            label="Lignes de la facture"
          />
        </section>

        <dl className="flex flex-col gap-3">
          {invoice.dueDate ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Échéance</dt>
              <dd>{formatDate(invoice.dueDate)}</dd>
            </div>
          ) : null}
          {invoice.conditions ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Conditions</dt>
              <dd className="whitespace-pre-line">{invoice.conditions}</dd>
            </div>
          ) : null}
          {invoice.issuedAt ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Émise</dt>
              <dd>{formatDateTime(invoice.issuedAt)}</dd>
            </div>
          ) : null}
        </dl>

        {draft && canWrite ? (
          <>
            <InvoiceDraftForm
              invoiceId={invoice.id}
              version={invoice.version}
              dueDate={invoice.dueDate ?? ""}
              conditions={invoice.conditions ?? ""}
              fromOrder={Boolean(invoice.order)}
            />
            <IssueInvoiceForm
              invoiceId={invoice.id}
              version={invoice.version}
              enabled={issueEnabled}
              missingProfile={!seller.fiscal.legal_name}
            />
            <DiscardInvoiceForm
              invoiceId={invoice.id}
              orderId={invoice.order?.id ?? null}
            />
          </>
        ) : null}

        {!draft ? (
          <section aria-labelledby="avoirs" className="flex flex-col gap-3">
            <h2 id="avoirs" className="text-lg font-semibold">
              Avoirs
            </h2>
            {invoice.creditNotes.length ? (
              <ul
                className="divide-y rounded-xl border bg-card"
                aria-label="Avoirs émis"
              >
                {invoice.creditNotes.map((note) => (
                  <li
                    key={note.id}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{note.number}</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(note.issueDate)} · {note.reason}
                      </span>
                      <a
                        href={`/dashboard/invoices/${invoice.id}/avoirs/${note.id}/pdf`}
                        target="_blank"
                        rel="noopener"
                        className="text-sm text-primary"
                      >
                        PDF de l&apos;avoir
                      </a>
                    </span>
                    <span className="shrink-0 font-medium">
                      − {formatXaf(note.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun avoir.</p>
            )}
            {canWrite && issueEnabled && Number(remaining) > 0 ? (
              <CreditNoteForm
                key={invoice.creditNotes.length}
                invoiceId={invoice.id}
                remaining={formatXaf(remaining)}
              />
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
