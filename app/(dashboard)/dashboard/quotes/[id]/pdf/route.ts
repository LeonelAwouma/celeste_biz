import { getBusinessContext } from "@/features/businesses/active-business";
import { quotePdfModel } from "@/features/documents/pdf-models";
import {
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import { getSellerProfile } from "@/features/invoices/queries";
import { getQuote } from "@/features/quotes/queries";
import { renderPdf } from "@/lib/pdf/render";
import { isoToLocalParts } from "@/lib/time";

export async function GET(
  _request: Request,
  { params }: RouteContext<"/dashboard/quotes/[id]/pdf">,
) {
  const { id } = await params;
  const { business } = await getBusinessContext();
  const [quote, seller] = await Promise.all([
    getQuote(business.id, id),
    getSellerProfile(business.id),
  ]);
  if (!quote) return notFoundResponse();

  const bytes = await renderPdf(
    quotePdfModel({
      code: quote.code,
      createdOn: isoToLocalParts(quote.sentAt ?? quote.createdAt).date,
      validUntil: quote.validUntil,
      status: quote.status,
      seller,
      customer: quote.customer,
      items: quote.items,
      subtotal: quote.subtotal,
      taxTotal: quote.taxTotal,
      total: quote.total,
      conditions: quote.conditions,
    }),
  );
  return pdfResponse(bytes, `${quote.code}.pdf`);
}
