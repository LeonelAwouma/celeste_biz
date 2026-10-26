import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, Pencil, Phone } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Notice } from "@/components/documents/notice";
import { PrepareInvoiceForm } from "@/components/invoices/invoice-forms";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { TrackingLinkPanel } from "@/components/tracking/tracking-link-panel";
import { CancelPaymentForm } from "@/components/orders/cancel-payment-form";
import { OrderDetailsView } from "@/components/orders/order-details-view";
import { PaymentForm } from "@/components/orders/payment-form";
import { StatusBadge } from "@/components/orders/status-badge";
import { TransitionActions } from "@/components/orders/transition-actions";
import { Button } from "@/components/ui/button";
import { getBusinessContext } from "@/features/businesses/active-business";
import { listMembers } from "@/features/businesses/team";
import { listOrderInvoices } from "@/features/invoices/queries";
import { getActiveTrackingLink } from "@/features/tracking/queries";
import { getOrder, type OrderEvent } from "@/features/orders/queries";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  availableTransitions,
  isLate,
  isTerminal,
  statusLabel,
} from "@/features/orders/status";
import { getProfessionTemplate } from "@/features/professions/registry";
import type { ProfessionTemplate } from "@/features/professions/schema";
import { sumAmounts } from "@/lib/monetary/decimal";
import { formatXaf } from "@/lib/monetary/xaf";
import { can } from "@/lib/permissions/roles";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime, todayLocal } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Commande" };

const CHANGED_LABELS: Record<string, string> = {
  customer: "client",
  items: "lignes",
  due_at: "échéance",
  assignee: "responsable",
  notes: "notes",
  details: "informations",
  production_step: "étape",
};

function describeEvent(
  event: OrderEvent,
  template: ProfessionTemplate,
): string {
  const amount = (value: unknown) => formatXaf(String(value ?? "0"));
  switch (event.type) {
    case "created":
      return `Commande créée (${statusLabel(event.toStatus ?? "confirmed", template)})`;
    case "status_changed": {
      const reason =
        typeof event.metadata.reason === "string"
          ? ` — motif : ${event.metadata.reason}`
          : "";
      return `${statusLabel(event.fromStatus!, template)} → ${statusLabel(event.toStatus!, template)}${reason}`;
    }
    case "updated": {
      const changed = Array.isArray(event.metadata.changed)
        ? (event.metadata.changed as string[])
        : [];
      return `Modifiée : ${changed.map((key) => CHANGED_LABELS[key] ?? key).join(", ")}`;
    }
    case "payment_recorded":
      return `Encaissement déclaré : ${amount(event.metadata.amount)}`;
    case "payment_cancelled":
      return `Encaissement annulé : ${amount(event.metadata.amount)}`;
  }
}

export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/dashboard/orders/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { business } = await getBusinessContext();
  const [order, members, invoices, tracking] = await Promise.all([
    getOrder(business.id, id),
    listMembers(business.id),
    listOrderInvoices(business.id, id),
    getActiveTrackingLink(business.id, id),
  ]);
  if (!order) notFound();

  const template = getProfessionTemplate(
    order.professionKey,
    order.professionVersion,
  );
  const names = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );
  const canWrite = can(business.role, "orders.write");
  const terminal = isTerminal(order.status);
  const hasBalance = Number(order.balance) > 0;
  const late = isLate(order.dueAt, order.status);
  const step = template.productionSteps.find(
    (s) => s.key === order.productionStep,
  );

  return (
    <>
      <Link
        href="/dashboard/orders"
        className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {template.labels.orders}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title={order.code} description={template.labels.order} />
        <StatusBadge
          status={order.status}
          template={template}
          className="mt-2"
        />
      </div>

      {query.enregistre === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Commande enregistrée.
        </p>
      ) : query.modifie === "1" ? (
        <p
          role="status"
          className="mb-4 rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground"
        >
          Modifications enregistrées.
        </p>
      ) : null}
      {query.depuis_devis === "1" ? (
        <Notice className="mb-4">
          Commande créée à partir du devis accepté.
        </Notice>
      ) : null}
      {query.acompte === "echec" ? (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          La commande est enregistrée, mais l&apos;acompte ne l&apos;a pas été.
          Ajoutez-le ci-dessous.
        </p>
      ) : null}

      <div className="flex flex-col gap-6">
        <section
          aria-label="Client"
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
        >
          <Link
            href={`/dashboard/customers/${order.customer.id}`}
            className="flex min-w-0 flex-1 flex-col"
          >
            <span className="truncate font-medium text-primary">
              {order.customer.name}
            </span>
            {order.customer.phone ? (
              <span className="text-sm text-muted-foreground">
                {formatPhone(order.customer.phone)}
              </span>
            ) : null}
          </Link>
          {order.customer.phone ? (
            <Button asChild variant="outline" size="icon">
              <a
                href={`tel:${order.customer.phone}`}
                aria-label={`Appeler ${order.customer.name}`}
              >
                <Phone aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </section>

        <section
          aria-label="Montants"
          className="grid grid-cols-3 gap-2 text-center"
        >
          <div className="rounded-xl border bg-card px-2 py-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p
              className="text-sm font-semibold break-words sm:text-base"
              data-testid="order-amount-total"
            >
              {formatXaf(order.total)}
            </p>
          </div>
          <div className="rounded-xl border bg-card px-2 py-3">
            <p className="text-xs text-muted-foreground">Encaissé</p>
            <p
              className="text-sm font-semibold break-words sm:text-base"
              data-testid="order-amount-paid"
            >
              {formatXaf(order.paidTotal)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl border px-2 py-3",
              hasBalance
                ? "bg-warning text-warning-foreground"
                : "bg-success text-success-foreground",
            )}
          >
            <p className="text-xs">Reste à payer</p>
            <p
              className="text-sm font-semibold break-words sm:text-base"
              data-testid="order-amount-balance"
            >
              {hasBalance ? formatXaf(order.balance) : "Soldée"}
            </p>
          </div>
        </section>

        {order.status === "cancelled" && order.cancelReason ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Annulée — motif : {order.cancelReason}
          </p>
        ) : null}

        <TransitionActions
          orderId={order.id}
          version={order.version}
          actions={availableTransitions(order.status, business.role, template)}
          blockedClose={
            hasBalance ? "Encaissez le solde avant de clôturer." : undefined
          }
        />

        <section aria-labelledby="infos" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="infos" className="text-lg font-semibold">
              Informations
            </h2>
            {canWrite && !terminal ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/orders/${order.id}/edit`}>
                  <Pencil aria-hidden="true" />
                  Modifier
                </Link>
              </Button>
            ) : null}
          </div>
          <dl className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">À remettre</dt>
              <dd className={cn(late && "font-medium text-destructive")}>
                {order.dueAt
                  ? `${late ? "En retard — " : ""}${formatDateTime(order.dueAt)}`
                  : "Pas de date fixée"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Responsable</dt>
              <dd>
                {order.assigneeId
                  ? (names.get(order.assigneeId) ?? "Ancien membre")
                  : "Personne"}
              </dd>
            </div>
            {step ? (
              <div className="flex flex-col gap-0.5">
                <dt className="text-sm text-muted-foreground">Étape</dt>
                <dd>{step.label}</dd>
              </div>
            ) : null}
          </dl>
          <OrderDetailsView
            fields={template.orderFields}
            details={order.details}
          />
          {order.notes ? (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <p className="font-medium">Notes internes</p>
              <p className="whitespace-pre-line">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="lignes">
          <h2 id="lignes" className="mb-2 text-lg font-semibold">
            Articles
          </h2>
          <ul
            className="divide-y rounded-xl border bg-card"
            aria-label="Articles de la commande"
          >
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{item.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.quantity.replace(".", ",")}
                    {item.unit ? ` ${item.unit}` : ""} ×{" "}
                    {formatXaf(item.unitPrice)}
                    {Number(item.discount) > 0
                      ? ` − remise ${formatXaf(item.discount)}`
                      : ""}
                    {Number(item.taxRate) > 0
                      ? ` · taxe ${item.taxRate.replace(".", ",")} %`
                      : ""}
                  </span>
                </span>
                <span className="shrink-0 font-medium">
                  {formatXaf(sumAmounts([item.lineNet, item.lineTax]))}
                </span>
              </li>
            ))}
            {Number(order.taxTotal) > 0 ? (
              <li className="flex justify-between px-4 py-2 text-sm text-muted-foreground">
                <span>Dont taxes</span>
                <span>{formatXaf(order.taxTotal)}</span>
              </li>
            ) : null}
          </ul>
        </section>

        <section
          aria-labelledby="encaissements"
          className="flex flex-col gap-3"
        >
          <h2 id="encaissements" className="text-lg font-semibold">
            Encaissements
          </h2>
          {order.payments.length ? (
            <ul
              className="divide-y rounded-xl border bg-card"
              aria-label="Encaissements enregistrés"
            >
              {order.payments.map((payment) => (
                <li
                  key={payment.id}
                  className={cn(
                    "px-4 py-3",
                    payment.status === "cancelled" && "opacity-70",
                  )}
                >
                  <p
                    className={cn(
                      "font-medium",
                      payment.status === "cancelled" && "line-through",
                    )}
                  >
                    {formatXaf(payment.amount)} ·{" "}
                    {PAYMENT_METHOD_LABELS[payment.method]}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(payment.paidOn)}
                    {payment.reference ? ` · réf. ${payment.reference}` : ""}
                    {payment.recordedBy
                      ? ` · par ${names.get(payment.recordedBy) ?? "un ancien membre"}`
                      : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_STATUS_LABELS[payment.status]}
                    {payment.cancelReason
                      ? ` — motif : ${payment.cancelReason}`
                      : ""}
                  </p>
                  <a
                    href={`/dashboard/orders/${order.id}/recus/${payment.id}`}
                    target="_blank"
                    rel="noopener"
                    className="mt-1 inline-flex min-h-9 items-center gap-1 text-sm text-primary"
                  >
                    <FileDown aria-hidden="true" className="size-4" />
                    Reçu PDF
                  </a>
                  {payment.status === "manual_declared" &&
                  order.status !== "closed" &&
                  can(business.role, "payments.cancel") ? (
                    <CancelPaymentForm
                      paymentId={payment.id}
                      orderId={order.id}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun encaissement enregistré.
            </p>
          )}
          {canWrite && !terminal && hasBalance ? (
            <div className="rounded-xl border bg-card p-3">
              <h3 className="mb-2 font-medium">Ajouter un encaissement</h3>
              <PaymentForm
                orderId={order.id}
                balance={order.balance}
                today={todayLocal()}
              />
            </div>
          ) : null}
        </section>

        {canWrite && order.status !== "draft" ? (
          <section aria-labelledby="suivi" className="flex flex-col gap-3">
            <h2 id="suivi" className="text-lg font-semibold">
              Suivi client
            </h2>
            <TrackingLinkPanel
              orderId={order.id}
              orderCode={order.code}
              businessName={business.name}
              customerName={order.customer.name}
              customerPhone={order.customer.phone}
              active={tracking}
              activeSummary={
                tracking
                  ? [
                      `Créé le ${formatDateTime(tracking.createdAt)}, valable jusqu'au ${formatDateTime(tracking.expiresAt)}.`,
                      tracking.viewCount
                        ? `Consulté ${tracking.viewCount} fois (dernière fois le ${formatDateTime(tracking.lastViewedAt!)}).`
                        : "Pas encore consulté.",
                      tracking.showAmounts
                        ? "Montants visibles."
                        : "Montants masqués.",
                    ].join(" ")
                  : null
              }
            />
          </section>
        ) : null}

        <section aria-labelledby="facturation" className="flex flex-col gap-3">
          <h2 id="facturation" className="text-lg font-semibold">
            Facturation
          </h2>
          {invoices.length ? (
            <ul
              className="divide-y rounded-xl border bg-card"
              aria-label="Factures de la commande"
            >
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 hover:bg-accent"
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="font-medium">
                        {invoice.number ?? "Brouillon de facture"}
                      </span>
                      <InvoiceStatusBadge
                        status={invoice.status}
                        className="self-start"
                      />
                    </span>
                    <span className="shrink-0 text-sm font-medium">
                      {formatXaf(invoice.total)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune facture pour cette commande.
            </p>
          )}
          {can(business.role, "invoices.write") &&
          order.status !== "draft" &&
          order.status !== "cancelled" &&
          !invoices.some((invoice) => invoice.status === "draft") ? (
            <PrepareInvoiceForm orderId={order.id} />
          ) : null}
        </section>

        <section aria-labelledby="historique">
          <h2 id="historique" className="mb-2 text-lg font-semibold">
            Historique
          </h2>
          <ol
            className="flex flex-col gap-2 border-l-2 pl-4"
            aria-label="Historique de la commande"
          >
            {order.events.map((event) => (
              <li key={event.id} className="text-sm">
                <p>{describeEvent(event, template)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                  {event.actorId
                    ? ` · ${names.get(event.actorId) ?? "Ancien membre"}`
                    : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
