import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderForm, type OrderFormValues } from "@/components/orders/order-form";
import { getOrder } from "@/lib/data/orders";
import { getClients } from "@/lib/data/clients";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const order = await getOrder(id);
  return { title: order ? `Edit ${order.orderNumber} · AEC-flow` : "Edit Order · AEC-flow" };
}

export default async function EditOrderPage({ params }: PageProps) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  // The form submits the client by NAME; surface the full roster for the picker,
  // ensuring this order's current client is present (and pre-selected).
  const clientNames = (await getClients()).map((c) => c.name);
  const clients = clientNames.includes(order.clientName)
    ? clientNames
    : [order.clientName, ...clientNames];

  const initial: OrderFormValues = {
    id: order.id,
    orderNumber: order.orderNumber,
    title: order.title,
    clientName: order.clientName,
    serviceType: order.serviceType ?? "",
    fee: order.fee,
    status: order.status,
    proposalRef: order.proposalRef ?? "",
    expectedStartDate: order.expectedStartDate ?? "",
    expectedEndDate: order.expectedEndDate ?? "",
    scopeSummary: order.scopeSummary ?? "",
    siteAddress: order.siteAddress ?? "",
    notes: order.notes ?? "",
  };

  const backHref = `/orders/${order.id}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {order.orderNumber}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit order</h2>
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{order.orderNumber}</span> · {order.title}
        </p>
      </div>
      <OrderForm mode="edit" clients={clients} initial={initial} />
    </div>
  );
}
