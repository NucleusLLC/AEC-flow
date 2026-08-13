import Link from "next/link";
import { Plus, ShoppingCart, PackageCheck, CircleDollarSign, ClipboardList, PackagePlus } from "lucide-react";
import { listPurchaseOrders, procurementSummary } from "@/lib/data/procurement";
import { PurchaseOrderList } from "@/components/procurement/purchase-order-list";
import { ProjectFilterBanner } from "@/components/projects/project-filter-banner";
import { getProject } from "@/lib/data/projects";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Procurement · AEC-flow" };

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  const proj = project ? await getProject(project) : null;
  const allOrders = await listPurchaseOrders();
  const orders = proj ? allOrders.filter((o) => o.projectId === project) : allOrders;
  const summary = proj ? null : await procurementSummary();
  const money = (n: number) => formatCurrency(n, summary?.currency ?? "USD", { maximumFractionDigits: 0 });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Procurement</h2>
          <p className="text-sm text-muted">Purchase orders issued to suppliers — track ordering through delivery.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/procurement/from-selections"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <PackagePlus className="h-4 w-4" />
            From selections
          </Link>
          <Link
            href="/procurement/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </Link>
        </div>
      </div>

      {proj ? (
        <ProjectFilterBanner projectName={proj.name} clearHref="/procurement" />
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile icon={ClipboardList} label="Purchase orders" value={String(summary.total)} />
          <Tile icon={ShoppingCart} label="Open" value={String(summary.open)} />
          <Tile icon={CircleDollarSign} label="Open value" value={money(summary.openValue)} />
          <Tile icon={PackageCheck} label="Received value" value={money(summary.receivedValue)} />
        </div>
      ) : null}

      <PurchaseOrderList orders={orders} />
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="card-surface rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
