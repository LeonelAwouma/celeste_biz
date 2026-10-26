import { getBusinessContext } from "@/features/businesses/active-business";
import { invoicePdfModel } from "@/features/documents/pdf-models";
import {
  archivedPdf,
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import {
  sellerFromSnapshot,
  partyFromSnapshot,
} from "@/features/documents/snapshots";
import { getInvoice, getSellerProfile } from "@/features/invoices/queries";
import { can } from "@/lib/permissions/roles";
import { renderPdf } from "@/lib/pdf/render";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/dashboard/invoices/[id]/pdf">,
) {
  const { id } = await params;
  const { business } = await getBusinessContext();
  const invoice = await getInvoice(business.id, id);
  if (!invoice || invoice.status === "discarded") return notFoundResponse();

  if (invoice.status === "draft") {
    // Brouillon : vendeur et client actuels, filigrane, jamais archivé.
    const seller = await getSellerProfile(business.id);
    const bytes = await renderPdf(
      invoicePdfModel({
        status: "draft",
        number: null,
        issueDate: null,
        dueDate: invoice.dueDate,
        orderCode: invoice.order?.code ?? null,
        seller,
        customer: invoice.customer,
        items: invoice.items,
        subtotal: invoice.subtotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total,
        conditions: invoice.conditions,
      }),
    );
    return pdfResponse(
      bytes,
      `brouillon-facture-${invoice.id.slice(0, 8)}.pdf`,
    );
  }

  // Facture émise : instantanés figés ; l'original archivé fait foi (les
  // avoirs ultérieurs sont des pièces distinctes).
  const render = () =>
    renderPdf(
      invoicePdfModel({
        status: "issued",
        number: invoice.number,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        orderCode: invoice.order?.code ?? null,
        seller: sellerFromSnapshot(invoice.seller),
        customer: partyFromSnapshot(invoice.buyer, invoice.customer),
        items: invoice.items,
        subtotal: invoice.subtotal,
        taxTotal: invoice.taxTotal,
        total: invoice.total,
        conditions: invoice.conditions,
      }),
    );
  const bytes = await archivedPdf({
    kind: "invoice",
    id: invoice.id,
    businessId: business.id,
    existingPath: invoice.pdfPath,
    path: `factures/${invoice.number}.pdf`,
    canArchive: can(business.role, "invoices.write"),
    render,
  });
  return pdfResponse(bytes, `${invoice.number}.pdf`);
}
