import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrdersView } from "@/components/orders/orders-view";
import { getOrders, summarizeOrders } from "@/lib/data/orders";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Orders · ZenArch" };

export default async function OrdersPage() {
  const orders = await getOrders();
  const summary = summarizeOrders(orders);

  const tiles = [
    {
      label: "Active Orders",
      value: String(summary.activeCount),
      hint: `${summary.unscheduled} awaiting project setup`,
    },
    {
      label: "Active Value",
      value: formatCurrencyCompact(summary.activeValue),
      hint: "confirmed & in progress",
    },
    {
      label: "Completed",
      value: String(summary.completedCount),
      hint: formatCurrencyCompact(summary.completedValue) + " delivered",
    },
    { label: "Total Orders", value: String(summary.total), hint: "all time" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Orders</h2>
          <p className="text-sm text-muted">
            Confirmed engagements from approved proposals — the bridge into project delivery.
          </p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Order
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t.value}</div>
            <div className="mt-1 text-xs text-faint">{t.hint}</div>
          </Card>
        ))}
      </div>

      <OrdersView orders={orders} />
    </div>
  );
}
