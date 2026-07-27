import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/orders/print-button";
import { OrderDocument } from "@/components/orders/order-document";
import { getOrder } from "@/lib/data/orders";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";

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
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to order
        </Link>
        <PrintButton />
      </div>

      {/* A4 document sheet */}
      <div className="my-6 print:my-0">
        <OrderDocument order={order} logoDataUrl={logoDataUrl} logo={{ position: logo.position, size: logo.size }} companyName={companyName} companyLocation={firm.location} />
      </div>

      <style>{`@page { size: A4; margin: 14mm; }`}</style>
    </div>
  );
}
