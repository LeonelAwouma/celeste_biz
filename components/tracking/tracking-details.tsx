import { notFound } from "next/navigation";
import { CircleCheck, Circle, FileDown, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { statusLabel } from "@/features/orders/status";
import { getProfessionTemplate } from "@/features/professions/registry";
import type { OrderState } from "@/features/professions/schema";
import { getTrackingView } from "@/features/tracking/queries";
import { formatXaf } from "@/lib/monetary/xaf";
import { formatDate, formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";

/** Étapes visibles par le client, dans l'ordre. */
const STEPS: OrderState[] = ["confirmed", "in_progress", "ready", "delivered"];

function stepIndex(status: OrderState): number {
  if (status === "closed") return STEPS.length - 1;
  if (status === "pending_confirmation") return -1;
  return STEPS.indexOf(status);
}

export async function TrackingDetails({
  tokenPromise,
}: {
  tokenPromise: Promise<string>;
}) {
  const token = await tokenPromise;
  const view = await getTrackingView(token);

  if (view.state === "not_found") notFound();

  if (view.state !== "valid") {
    return (
      <Card>
        <CardHeader>
          <h1 className="text-2xl leading-tight font-semibold">
            {view.state === "expired" ? "Lien expiré" : "Lien désactivé"}
          </h1>
          <CardDescription>
            {view.state === "expired"
              ? "Ce lien de suivi a expiré."
              : "Ce lien de suivi a été désactivé."}{" "}
            Demandez un nouveau lien à {view.businessName}.
          </CardDescription>
        </CardHeader>
        {view.businessPhone ? (
          <Button asChild>
            <a
              href={whatsappLink(
                view.businessPhone,
                "Bonjour, pouvez-vous m'envoyer un nouveau lien de suivi de ma commande ?",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle aria-hidden="true" />
              Écrire sur WhatsApp
            </a>
          </Button>
        ) : null}
      </Card>
    );
  }

  const template = getProfessionTemplate(
    view.professionKey,
    view.professionVersion,
  );
  const { order } = view;
  const current = stepIndex(order.status);
  const stopped = order.status === "cancelled" || order.status === "disputed";
  const step = template.productionSteps.find(
    (s) => s.key === order.productionStep,
  );
  const base = `/suivi/${token}`;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-primary">{view.businessName}</p>
        <h1 className="text-2xl font-bold">Commande {order.code}</h1>
        <p className="text-sm text-muted-foreground">
          Pour {order.customerName}
        </p>
      </header>

      <section
        aria-label="État de la commande"
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
      >
        <p className="text-sm text-muted-foreground">État actuel</p>
        <p className="text-xl font-semibold" data-testid="tracking-status">
          {statusLabel(order.status, template)}
          {step && order.status === "in_progress" ? ` · ${step.label}` : ""}
        </p>
        {stopped ? null : (
          <ol className="flex flex-col gap-2" aria-label="Étapes">
            {STEPS.map((s, index) => {
              const done = current >= index;
              const Icon = done ? CircleCheck : Circle;
              return (
                <li
                  key={s}
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    done ? "font-medium" : "text-muted-foreground",
                  )}
                  aria-current={current === index ? "step" : undefined}
                >
                  <Icon
                    aria-hidden="true"
                    className={cn(
                      "size-5 shrink-0",
                      done ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {statusLabel(s, template)}
                </li>
              );
            })}
          </ol>
        )}
        <dl className="flex flex-col gap-2 border-t pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Dernière mise à jour</dt>
            <dd className="text-right">{formatDateTime(order.updatedAt)}</dd>
          </div>
          {order.dueAt ? (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Échéance indicative</dt>
              <dd className="text-right">{formatDateTime(order.dueAt)}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="articles" className="flex flex-col gap-2">
        <h2 id="articles" className="font-semibold">
          Articles
        </h2>
        <ul className="divide-y rounded-xl border bg-card">
          {view.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3 px-4 py-3">
              <span className="min-w-0 break-words">{item.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {item.quantity.replace(".", ",")}
                {item.unit ? ` ${item.unit}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {view.amounts ? (
        <section aria-labelledby="montants" className="flex flex-col gap-2">
          <h2 id="montants" className="font-semibold">
            Montants
          </h2>
          <dl className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd>{formatXaf(view.amounts.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Déjà réglé</dt>
              <dd>{formatXaf(view.amounts.paidTotal)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Reste à payer</dt>
              <dd data-testid="tracking-balance">
                {formatXaf(view.amounts.balance)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Règlements tels qu&apos;enregistrés par {view.businessName}.
          </p>
        </section>
      ) : null}

      {view.documents &&
      (view.documents.receipts.length || view.documents.invoices.length) ? (
        <section aria-labelledby="pieces" className="flex flex-col gap-2">
          <h2 id="pieces" className="font-semibold">
            Documents
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {view.documents.invoices.map((invoice) => (
              <li key={invoice.id}>
                <a
                  href={`${base}/facture/${invoice.id}`}
                  className="flex min-h-12 items-center gap-2 px-4 py-2 text-primary"
                >
                  <FileDown aria-hidden="true" className="size-4" />
                  Facture {invoice.number} du {formatDate(invoice.issueDate)}
                </a>
              </li>
            ))}
            {view.documents.receipts.map((receipt) => (
              <li key={receipt.id}>
                <a
                  href={`${base}/recu/${receipt.id}`}
                  className="flex min-h-12 items-center gap-2 px-4 py-2 text-primary"
                >
                  <FileDown aria-hidden="true" className="size-4" />
                  Reçu de {formatXaf(receipt.amount)} du{" "}
                  {formatDate(receipt.paidOn)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.history.length ? (
        <section aria-labelledby="historique" className="flex flex-col gap-2">
          <h2 id="historique" className="font-semibold">
            Historique
          </h2>
          <ol className="flex flex-col gap-2 border-l-2 pl-4 text-sm">
            {view.history.map((entry, index) => (
              <li key={index}>
                <p>{statusLabel(entry.toStatus, template)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(entry.at)}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {view.businessPhone ? (
        <Button asChild size="lg">
          <a
            href={whatsappLink(
              view.businessPhone,
              `Bonjour, j'ai une question sur ma commande ${order.code}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MessageCircle aria-hidden="true" />
            Contacter {view.businessName}
          </a>
        </Button>
      ) : null}
      <p className="text-center text-xs text-muted-foreground">
        Lien personnel valable jusqu&apos;au {formatDate(view.expiresAt)}. Ne le
        partagez pas.
      </p>
    </div>
  );
}
