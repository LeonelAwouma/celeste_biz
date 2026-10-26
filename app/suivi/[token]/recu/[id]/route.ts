import {
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import { trackingReceiptModel } from "@/features/tracking/documents";
import { getTrackingDocument } from "@/features/tracking/queries";
import { renderPdf } from "@/lib/pdf/render";

/** Reçu téléchargé par le client depuis son lien de suivi (sans compte). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/suivi/[token]/recu/[id]">,
) {
  const { token, id } = await params;
  const data = await getTrackingDocument(token, "receipt", id);
  if (!data) return notFoundResponse();
  const { model, filename } = trackingReceiptModel(data);
  return pdfResponse(await renderPdf(model), filename);
}
