"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  keepValues,
  toFieldErrors,
  type FormState,
} from "@/features/auth/schemas";
import { requireActiveBusiness } from "@/features/businesses/active-business";
import { isFiscalInvoiceIssueEnabled } from "@/lib/env";
import { can } from "@/lib/permissions/roles";
import { createClient } from "@/lib/supabase/server";

import {
  FISCAL_PROFILE_FIELDS,
  ISSUE_DISABLED_MESSAGE,
  compactProfile,
  creditNoteSchema,
  fiscalProfileSchema,
  invoiceDraftSchema,
} from "./schemas";

const FORBIDDEN: FormState = {
  status: "error",
  message: "Votre rôle ne permet pas cette action.",
};

const NETWORK: FormState = {
  status: "error",
  message: "Rien n'a été enregistré. Vérifiez votre connexion et réessayez.",
};

function rpcFailure(
  error: { code?: string; message: string },
  values?: Record<string, string>,
): FormState {
  switch (error.code) {
    case "CB422":
      return { status: "error", message: error.message, values };
    case "CB409":
      return {
        status: "error",
        message:
          "La facture a été modifiée entre-temps. Rechargez la page pour voir la dernière version.",
        values,
      };
    case "42501":
      return { ...FORBIDDEN, values };
    default:
      return { ...NETWORK, values };
  }
}

function revalidateInvoice(invoiceId: string, orderId?: string | null) {
  revalidatePath("/dashboard/invoices");
  revalidatePath(`/dashboard/invoices/${invoiceId}`);
  if (orderId) revalidatePath(`/dashboard/orders/${orderId}`);
}

/** « Préparer une facture » depuis une commande : brouillon sans numéro. */
export async function createInvoiceDraft(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "invoices.write")) return FORBIDDEN;
  const id = z.uuid().safeParse(formData.get("id"));
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  if (!id.success || !orderId.success)
    return { status: "error", message: "Action invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_invoice_from_order", {
    p_id: id.data,
    p_order_id: orderId.data,
  });
  if (error) return rpcFailure(error);

  revalidateInvoice(id.data, orderId.data);
  redirect(`/dashboard/invoices/${id.data}`);
}

export async function updateInvoiceDraft(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "invoices.write")) return FORBIDDEN;
  const values = keepValues(formData, ["dueDate", "conditions"]);
  const parsed = invoiceDraftSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_invoice_draft", {
    p_invoice_id: parsed.data.invoiceId,
    p_expected_version: parsed.data.version,
    p_due_date: parsed.data.dueDate,
    p_conditions: parsed.data.conditions,
    p_refresh_items: parsed.data.refreshItems,
  });
  if (error) return rpcFailure(error, values);

  revalidateInvoice(
    parsed.data.invoiceId,
    (data as { order_id: string | null }).order_id,
  );
  return {
    status: "success",
    message: parsed.data.refreshItems
      ? "Brouillon enregistré, lignes reprises de la commande."
      : "Brouillon enregistré.",
  };
}

export async function discardInvoiceDraft(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "invoices.write")) return FORBIDDEN;
  const id = z.uuid().safeParse(formData.get("invoiceId"));
  if (!id.success) return { status: "error", message: "Action invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("discard_invoice_draft", {
    p_invoice_id: id.data,
  });
  if (error) return rpcFailure(error);

  revalidateInvoice(id.data);
  const orderId = z.uuid().safeParse(formData.get("orderId"));
  redirect(
    orderId.success
      ? `/dashboard/orders/${orderId.data}`
      : "/dashboard/invoices",
  );
}

/** Émission définitive : double interrupteur (variable serveur + base). */
export async function issueInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "invoices.write")) return FORBIDDEN;
  if (!isFiscalInvoiceIssueEnabled()) {
    return { status: "error", message: ISSUE_DISABLED_MESSAGE };
  }
  const id = z.uuid().safeParse(formData.get("invoiceId"));
  const version = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("version"));
  if (!id.success || !version.success)
    return { status: "error", message: "Action invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", {
    p_invoice_id: id.data,
    p_expected_version: version.data,
  });
  if (error) return rpcFailure(error);

  revalidateInvoice(id.data, (data as { order_id: string | null }).order_id);
  redirect(`/dashboard/invoices/${id.data}?emise=1`);
}

export async function issueCreditNote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "invoices.write")) return FORBIDDEN;
  if (!isFiscalInvoiceIssueEnabled()) {
    return {
      status: "error",
      message:
        "L'émission des avoirs est désactivée tant que la conformité fiscale n'est pas validée.",
    };
  }
  const values = keepValues(formData, ["amount", "reason"]);
  const parsed = creditNoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_credit_note", {
    p_id: parsed.data.id,
    p_invoice_id: parsed.data.invoiceId,
    p_amount: parsed.data.amount,
    p_reason: parsed.data.reason,
  });
  if (error) return rpcFailure(error, values);

  revalidateInvoice(parsed.data.invoiceId);
  redirect(`/dashboard/invoices/${parsed.data.invoiceId}?avoir=1`);
}

export async function updateFiscalProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const business = await requireActiveBusiness();
  if (!can(business.role, "business.update")) return FORBIDDEN;
  const values = keepValues(formData, FISCAL_PROFILE_FIELDS);
  const parsed = fiscalProfileSchema.safeParse(values);
  if (!parsed.success) return toFieldErrors(parsed.error, values);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_fiscal_profile", {
    p_business_id: business.id,
    p_profile: compactProfile(parsed.data),
  });
  if (error) return rpcFailure(error, values);

  revalidatePath("/dashboard/settings");
  return {
    status: "success",
    message: "Profil de facturation enregistré.",
    values,
  };
}
