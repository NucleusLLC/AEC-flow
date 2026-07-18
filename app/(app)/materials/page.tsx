import Link from "next/link";
import { Plus, Boxes, CircleCheck, Clock, CircleDollarSign, Printer } from "lucide-react";
import { listMaterialSelections, materialsSummary } from "@/lib/data/materials";
import { MaterialList } from "@/components/materials/material-list";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Material Selection · AEC-flow" };

export default async function MaterialsPage() {
  const [items, summary] = await Promise.all([listMaterialSelections(), materialsSummary()]);
  const money = (n: number) => formatCurrency(n, summary.currency, { maximumFractionDigits: 0 });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Material Selection</h2>
          <p className="text-sm text-muted">The finish &amp; product schedule — track selections from proposal to install.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {items.length > 0 ? (
            <Link
              href="/print/materials"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              <Printer className="h-4 w-4" /> Print schedule
            </Link>
          ) : null}
          <Link
            href="/materials/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Add selection
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={Boxes} label="Selections" value={String(summary.total)} />
        <Tile icon={Clock} label="Pending" value={String(summary.pending)} />
        <Tile icon={CircleCheck} label="Approved+" value={String(summary.approved)} />
        <Tile icon={CircleDollarSign} label="Selected value" value={money(summary.selectedValue)} />
      </div>

      <MaterialList items={items} />
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
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
