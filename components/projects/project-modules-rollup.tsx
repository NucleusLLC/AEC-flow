import Link from "next/link";
import { ShoppingCart, Boxes, FileStack, ArrowUpRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { ProjectModulesRollup } from "@/lib/data/project-rollup";

export function ProjectModulesRollupCard({ rollup }: { rollup: ProjectModulesRollup }) {
  const rows = [
    {
      href: "/procurement",
      icon: ShoppingCart,
      label: "Purchase orders",
      value: rollup.purchaseOrders.total,
      sub:
        rollup.purchaseOrders.total > 0
          ? `${rollup.purchaseOrders.open} open · ${formatCurrency(rollup.purchaseOrders.value, rollup.purchaseOrders.currency, { maximumFractionDigits: 0 })}`
          : "None yet",
    },
    {
      href: "/materials",
      icon: Boxes,
      label: "Material selections",
      value: rollup.materials.total,
      sub: rollup.materials.total > 0 ? `${rollup.materials.approved} approved+` : "None yet",
    },
    {
      href: "/design",
      icon: FileStack,
      label: "Design deliverables",
      value: rollup.deliverables.total,
      sub: rollup.deliverables.total > 0 ? `${rollup.deliverables.issued} issued` : "None yet",
    },
  ];

  return (
    <Card>
      <CardHeader title="Procurement, Materials & Design" subtitle="Across this project" />
      <div className="divide-y divide-border">
        {rows.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.href}
              href={r.href}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2/40"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-fg">{r.label}</div>
                <div className="text-xs text-muted">{r.sub}</div>
              </div>
              <span className="text-lg font-semibold tabular-nums text-fg">{r.value}</span>
              <ArrowUpRight className="h-4 w-4 text-faint group-hover:text-brand" />
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
