import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderForm } from "@/components/orders/order-form";
import { getClients } from "@/lib/data/clients";

export const metadata = { title: "New Order · AEC-flow" };

export default async function NewOrderPage() {
  const clients = await getClients();
  const clientNames = clients.map((c) => c.name);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/orders"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Orders
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">New Order</h2>
        <p className="text-sm text-muted">Create a confirmed engagement, usually from an approved proposal.</p>
      </div>

      <OrderForm clients={clientNames} />
    </div>
  );
}
