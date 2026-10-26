"use client";

import { useActionState, useState } from "react";
import { Copy, Link2, MessageCircle } from "lucide-react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormMessage } from "@/components/forms/form-message";
import { SelectField } from "@/components/forms/select-field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { initialFormState } from "@/features/auth/schemas";
import {
  createTrackingLink,
  revokeTrackingLink,
} from "@/features/tracking/actions";
import type { TrackingLinkInfo } from "@/features/tracking/queries";
import { whatsappLink } from "@/lib/whatsapp";

const DURATIONS = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
];

/**
 * Lien de suivi privé à partager au client (WhatsApp, SMS…). Le lien n'est
 * montré qu'à sa création : seul son condensat est conservé.
 */
export function TrackingLinkPanel({
  orderId,
  orderCode,
  businessName,
  customerName,
  customerPhone,
  active,
  activeSummary,
}: {
  orderId: string;
  orderCode: string;
  businessName: string;
  customerName: string;
  customerPhone: string | null;
  active: TrackingLinkInfo | null;
  /** Résumé lisible du lien actif (dates formatées côté serveur). */
  activeSummary: string | null;
}) {
  const [state, action] = useActionState(createTrackingLink, initialFormState);
  const [revokeState, revoke] = useActionState(
    revokeTrackingLink,
    initialFormState,
  );
  const [copied, setCopied] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const link = state.status === "success" ? state.data?.link : undefined;
  const shareText = link
    ? `Bonjour ${customerName}, suivez l'avancement de votre commande ${orderCode} chez ${businessName} : ${link}`
    : "";

  return (
    <div className="flex flex-col gap-3">
      <FormMessage state={revokeState} />
      {link ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-card p-3">
          <FormMessage state={state} />
          <code
            data-testid="tracking-link"
            className="block rounded-md bg-muted px-3 py-2 text-sm break-all"
          >
            {link}
          </code>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Copy aria-hidden="true" />
              {copied ? "Copié" : "Copier"}
            </Button>
            <Button asChild variant="outline">
              <a
                href={whatsappLink(customerPhone, shareText)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle aria-hidden="true" />
                WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : active ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <Link2 aria-hidden="true" className="size-4 text-primary" />
            Lien de suivi actif
          </p>
          <p className="text-muted-foreground" data-testid="tracking-active">
            {activeSummary}
          </p>
          <p className="text-muted-foreground">
            Le lien n&apos;est plus affichable. Pour le renvoyer, créez-en un
            nouveau : l&apos;ancien cessera de fonctionner.
          </p>
          <form action={revoke}>
            <input type="hidden" name="linkId" value={active.id} />
            <input type="hidden" name="orderId" value={orderId} />
            <SubmitButton
              variant="ghost"
              className="text-destructive"
              pendingLabel="…"
            >
              Révoquer le lien
            </SubmitButton>
          </form>
        </div>
      ) : null}

      {showForm || (!active && !link) ? (
        <form
          action={action}
          noValidate
          className="flex flex-col gap-3 rounded-xl border bg-card p-3"
        >
          <input type="hidden" name="orderId" value={orderId} />
          {state.status === "error" ? <FormMessage state={state} /> : null}
          <p className="text-sm text-muted-foreground">
            Le client voit l&apos;état, l&apos;échéance et les articles, sans
            compte. Jamais vos notes internes.
          </p>
          <SelectField
            name="days"
            label="Valable pendant"
            defaultValue="60"
            options={DURATIONS}
          />
          <CheckboxField
            name="showAmounts"
            label="Montrer le total et le reste à payer"
            defaultChecked
          />
          <CheckboxField
            name="showDocuments"
            label="Permettre de télécharger les reçus et factures émises"
            defaultChecked
          />
          <SubmitButton pendingLabel="Création…">
            {active ? "Créer un nouveau lien" : "Créer le lien de suivi"}
          </SubmitButton>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowForm(true)}
        >
          {link ? "Créer un autre lien" : "Créer un nouveau lien"}
        </Button>
      )}
    </div>
  );
}
