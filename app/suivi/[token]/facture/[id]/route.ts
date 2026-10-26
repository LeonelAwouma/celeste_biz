import {
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import { trackingInvoiceModel } from "@/features/tracking/documents";
import { getTrackingDocument } from "@/features/tracking/queries";
import { renderPdf } from "@/lib/pdf/render";

/** Facture émise téléchargée par le client depuis son lien de suivi. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/suivi/[token]/facture/[id]">,
) {
  const { token, id } = await params;
  const data = await getTrackingDocument(token, "invoice", id);
  if (!data) return notFoundResponse();
  const { model, filename } = trackingInvoiceModel(data);
  return pdfResponse(await renderPdf(model), filename);
}
