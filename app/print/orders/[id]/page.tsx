import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDocument } from "@/components/orders/order-document";
import { getOrder } from "@/lib/data/orders";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(id);
  return { title: order ? `${order.orderNumber} — Order Confirmation` : "Order Confirmation" };
}

export default async function OrderPrintPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const { logoDataUrl, logo } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  return (
    // See the note on the meetings route: the document is the content, the surface
    // is the page. The signature block already opts out of splitting with
    // `data-keep-together`, but that rule only exists inside `.aec-doc`, which this
    // route was never inside — so a signature could be cut from the name it
    // belongs to, which is precisely what that attribute was added to prevent.
    <PrintSurface backHref={`/orders/${order.id}`} backLabel="Back to order">
      <OrderDocument
        order={order}
        logoDataUrl={logoDataUrl}
        logo={{ position: logo.position, size: logo.size }}
        companyName={companyName}
        companyLocation={firm.location}
        sheet={false}
      />
    </PrintSurface>
  );
}
