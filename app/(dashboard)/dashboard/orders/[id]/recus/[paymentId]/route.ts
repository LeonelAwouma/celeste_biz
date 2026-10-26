import { getBusinessContext } from "@/features/businesses/active-business";
import { receiptPdfModel } from "@/features/documents/pdf-models";
import {
  notFoundResponse,
  pdfResponse,
} from "@/features/documents/pdf-response";
import { getSellerProfile } from "@/features/invoices/queries";
import { getOrder } from "@/features/orders/queries";
import { PAYMENT_METHOD_LABELS } from "@/features/orders/status";
import { renderPdf } from "@/lib/pdf/render";

/** Reçu d'un encaissement déclaré (non vérifié, sans valeur fiscale). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/dashboard/orders/[id]/recus/[paymentId]">,
) {
  const { id, paymentId } = await params;
  const { business } = await getBusinessContext();
  const [order, seller] = await Promise.all([
    getOrder(business.id, id),
    getSellerProfile(business.id),
  ]);
  const payment = order?.payments.find((entry) => entry.id === paymentId);
  if (!order || !payment) return notFoundResponse();

  const bytes = await renderPdf(
    receiptPdfModel({
      orderCode: order.code,
      paidOn: payment.paidOn,
      method: PAYMENT_METHOD_LABELS[payment.method],
      reference: payment.reference,
      amount: payment.amount,
      cancelled: payment.status === "cancelled",
      orderTotal: order.total,
      balance: order.balance,
      seller,
      customer: order.customer,
    }),
  );
  return pdfResponse(bytes, `recu-${order.code}-${payment.paidOn}.pdf`);
}
