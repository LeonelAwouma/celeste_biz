"use client";

import { useActionState, useState } from "react";
import { FilePlus2, Lock } from "lucide-react";

import { CheckboxField } from "@/components/forms/checkbox-field";
import { FormField } from "@/components/forms/form-field";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { TextareaField } from "@/components/forms/textarea-field";
import { initialFormState } from "@/features/auth/schemas";
import {
  createInvoiceDraft,
  discardInvoiceDraft,
  issueCreditNote,
  issueInvoice,
  updateInvoiceDraft,
} from "@/features/invoices/actions";

/** « Préparer une facture » : brouillon créé depuis la commande. */
export function PrepareInvoiceForm({ orderId }: { orderId: string }) {
  const [state, action] = useActionState(createInvoiceDraft, initialFormState);
  const [id] = useState(() => crypto.randomUUID());
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="Préparation…">
        <FilePlus2 aria-hidden="true" />
        Préparer une facture
      </SubmitButton>
    </form>
  );
}

export function InvoiceDraftForm({
  invoiceId,
  version,
  dueDate,
  conditions,
  fromOrder,
}: {
  invoiceId: string;
  version: number;
  dueDate: string;
  conditions: string;
  fromOrder: boolean;
}) {
  const [state, action] = useActionState(updateInvoiceDraft, initialFormState);
  const values = state.values ?? { dueDate, conditions };
  return (
    <form
      noValidate
      action={action}
      // Nouvelle version après enregistrement : formulaire remonté.
      key={version}
      className="flex flex-col gap-4 rounded-xl border bg-card p-3"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="version" value={version} />
      <h2 className="font-semibold">Préparer le brouillon</h2>
      <FormMessage state={state} />
      <FormField
        name="dueDate"
        label="Échéance de paiement (facultatif)"
        type="date"
        defaultValue={values.dueDate}
        errors={state.fieldErrors?.dueDate}
      />
      <TextareaField
        name="conditions"
        label="Conditions de paiement (facultatif)"
        hint="Ex. payable à réception, par Mobile Money ou en espèces."
        defaultValue={values.conditions}
        maxLength={2000}
        errors={state.fieldErrors?.conditions}
      />
      {fromOrder ? (
        <CheckboxField
          name="refreshItems"
          label="Reprendre les lignes actuelles de la commande"
          description="Utile si la commande a été modifiée depuis la préparation."
        />
      ) : null}
      <SubmitButton variant="outline" pendingLabel="Enregistrement…">
        Enregistrer le brouillon
      </SubmitButton>
    </form>
  );
}

/**
 * Émission définitive. Tant que la conformité fiscale n'est pas validée, le
 * bouton est désactivé et l'explication affichée (le serveur refuse aussi).
 */
export function IssueInvoiceForm({
  invoiceId,
  version,
  enabled,
  missingProfile,
}: {
  invoiceId: string;
  version: number;
  enabled: boolean;
  missingProfile: boolean;
}) {
  const [state, action] = useActionState(issueInvoice, initialFormState);
  const blocked = !enabled || missingProfile;
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Émettre la facture ? Elle recevra un numéro définitif et ne pourra plus être modifiée (correction par avoir uniquement).",
          )
        )
          event.preventDefault();
      }}
      className="flex flex-col gap-2 rounded-xl border bg-card p-3"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <input type="hidden" name="version" value={version} />
      <h2 className="font-semibold">Émission</h2>
      <FormMessage state={state} />
      {!enabled ? (
        <p
          className="flex gap-2 text-sm text-muted-foreground"
          data-testid="issue-disabled-reason"
        >
          <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          L&apos;émission définitive des factures est désactivée tant que la
          conformité fiscale de Céleste Biz n&apos;est pas validée. Vous pouvez
          préparer le brouillon et le partager en PDF, marqué « brouillon ».
        </p>
      ) : missingProfile ? (
        <p className="text-sm text-muted-foreground">
          Renseignez d&apos;abord la raison sociale dans Paramètres › Profil de
          facturation.
        </p>
      ) : null}
      <SubmitButton disabled={blocked} pendingLabel="Émission…">
        Émettre la facture
      </SubmitButton>
    </form>
  );
}

export function DiscardInvoiceForm({
  invoiceId,
  orderId,
}: {
  invoiceId: string;
  orderId: string | null;
}) {
  const [state, action] = useActionState(discardInvoiceDraft, initialFormState);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Abandonner ce brouillon de facture ?"))
          event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}
      <FormMessage state={state} />
      <SubmitButton
        variant="ghost"
        className="text-destructive"
        pendingLabel="…"
      >
        Abandonner le brouillon
      </SubmitButton>
    </form>
  );
}

export function CreditNoteForm({
  invoiceId,
  remaining,
}: {
  invoiceId: string;
  remaining: string;
}) {
  const [state, action] = useActionState(issueCreditNote, initialFormState);
  // Identifiant stable : un double envoi ne crée pas deux avoirs. Le parent
  // remonte le formulaire (clé) après chaque avoir émis.
  const [id] = useState(() => crypto.randomUUID());
  return (
    <form
      noValidate
      action={action}
      className="flex flex-col gap-3 rounded-xl border bg-card p-3"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <h3 className="font-medium">Établir un avoir</h3>
      <p className="text-sm text-muted-foreground">
        La facture émise reste inchangée ; l&apos;avoir la corrige. Au plus{" "}
        {remaining} restent à créditer.
      </p>
      <FormMessage state={state} />
      <FormField
        name="amount"
        label="Montant (FCFA)"
        inputMode="decimal"
        defaultValue={state.values?.amount}
        errors={state.fieldErrors?.amount}
      />
      <TextareaField
        name="reason"
        label="Motif"
        maxLength={500}
        defaultValue={state.values?.reason}
        errors={state.fieldErrors?.reason}
      />
      <SubmitButton variant="outline" pendingLabel="Émission…">
        Émettre l&apos;avoir
      </SubmitButton>
    </form>
  );
}
