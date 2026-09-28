import Link from "next/link";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OrdersView } from "@/components/orders/orders-view";
import { getOrders, summarizeOrders } from "@/lib/data/orders";
import { formatCurrencyCompact } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata() {
  const t = await getServerT();
  return { title: `${t("Orders")} · AEC-flow` };
}

export default async function OrdersPage() {
  const t = await getServerT();
  const orders = await getOrders();
  const summary = summarizeOrders(orders);

  const tiles = [
    {
      label: t("Active Orders"),
      value: String(summary.activeCount),
      hint: fmt(t("{count} awaiting project setup"), { count: summary.unscheduled }),
    },
    {
      label: t("Active Value"),
      value: formatCurrencyCompact(summary.activeValue),
      hint: t("confirmed & in progress"),
    },
    {
      label: t("Completed"),
      value: String(summary.completedCount),
      hint: fmt(t("{amount} delivered"), { amount: formatCurrencyCompact(summary.completedValue) }),
    },
    { label: t("Total Orders"), value: String(summary.total), hint: t("all time") },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Orders")}</h2>
          <p className="text-sm text-muted">
            {t("Confirmed engagements from approved proposals — the bridge into project delivery.")}
          </p>
        </div>
        <Link
          href="/orders/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          {t("New Order")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-5">
            <div className="text-sm text-muted">{tile.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{tile.value}</div>
            <div className="mt-1 text-xs text-faint">{tile.hint}</div>
          </Card>
        ))}
      </div>

      <OrdersView orders={orders} />
    </div>
  );
}
