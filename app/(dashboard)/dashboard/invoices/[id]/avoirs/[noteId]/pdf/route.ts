import { getBusinessContext } from "@/features/businesses/active-business";
import { creditNotePdfModel } from "@/features/documents/pdf-models";
import {
  archivedPdf,
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import {
  partyFromSnapshot,
  sellerFromSnapshot,
} from "@/features/documents/snapshots";
import { getInvoice } from "@/features/invoices/queries";
import { can } from "@/lib/permissions/roles";
import { renderPdf } from "@/lib/pdf/render";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/dashboard/invoices/[id]/avoirs/[noteId]/pdf">,
) {
  const { id, noteId } = await params;
  const { business } = await getBusinessContext();
  const invoice = await getInvoice(business.id, id);
  const note = invoice?.creditNotes.find((entry) => entry.id === noteId);
  if (!invoice || !note || !invoice.number) return notFoundResponse();

  const supabase = await createClient();
  const { data: stored } = await supabase
    .from("credit_notes")
    .select("pdf_path")
    .eq("id", note.id)
    .maybeSingle();

  const bytes = await archivedPdf({
    kind: "credit_note",
    id: note.id,
    businessId: business.id,
    existingPath: stored?.pdf_path ?? null,
    path: `avoirs/${note.number}.pdf`,
    canArchive: can(business.role, "invoices.write"),
    render: () =>
      renderPdf(
        creditNotePdfModel({
          number: note.number,
          issueDate: note.issueDate,
          invoiceNumber: invoice.number!,
          reason: note.reason,
          amount: note.amount,
          seller: sellerFromSnapshot(invoice.seller),
          customer: partyFromSnapshot(invoice.buyer, invoice.customer),
        }),
      ),
  });
  return pdfResponse(bytes, `${note.number}.pdf`);
}
