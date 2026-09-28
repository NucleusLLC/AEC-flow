import Link from "next/link";
import { ShoppingCart, Boxes, FileStack, ArrowUpRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { ProjectModulesRollup } from "@/lib/data/project-rollup";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function ProjectModulesRollupCard({
  rollup,
  projectId,
}: {
  rollup: ProjectModulesRollup;
  projectId: string;
}) {
  const t = await getServerT();
  const q = `?project=${encodeURIComponent(projectId)}`;
  const rows = [
    {
      href: `/procurement${q}`,
      icon: ShoppingCart,
      label: t("Purchase orders"),
      value: rollup.purchaseOrders.total,
      sub:
        rollup.purchaseOrders.total > 0
          ? `${fmt(t("{count} open"), { count: rollup.purchaseOrders.open })} · ${formatCurrency(rollup.purchaseOrders.value, rollup.purchaseOrders.currency, { maximumFractionDigits: 0 })}`
          : t("None yet"),
    },
    {
      href: `/materials${q}`,
      icon: Boxes,
      label: t("Material selections"),
      value: rollup.materials.total,
      sub: rollup.materials.total > 0 ? fmt(t("{count} approved+"), { count: rollup.materials.approved }) : t("None yet"),
    },
    {
      href: `/design${q}`,
      icon: FileStack,
      label: t("Design deliverables"),
      value: rollup.deliverables.total,
      sub: rollup.deliverables.total > 0 ? fmt(t("{count} issued"), { count: rollup.deliverables.issued }) : t("None yet"),
    },
  ];

  return (
    <Card>
      <CardHeader title={t("Procurement, Materials & Design")} subtitle={t("Across this project")} />
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
