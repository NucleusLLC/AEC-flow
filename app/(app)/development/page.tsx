import Link from "next/link";
import { Map, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DevStatusBadge } from "@/components/development/badges";
import { DEV_PROJECT_TYPE_LABEL } from "@/lib/data/development.types";
import { listDevelopmentProjects } from "@/lib/data/development";
import { formatCurrency, formatNumber } from "@/lib/format";

export const metadata = { title: "Land Development · AEC-flow" };

export default async function DevelopmentListPage() {
  const projects = await listDevelopmentProjects();
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg">
            <Map className="h-5 w-5 text-brand" /> Land Development
          </h1>
          <p className="text-sm text-muted">Parceling-plan pro formas — acquisition, infrastructure, lots, units, sales and profit, A to Z.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/development/${p.id}`}>
            <Card className="group h-full p-5 transition-colors hover:border-brand/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-faint">{p.projectNumber}</div>
                  <h3 className="mt-0.5 truncate font-semibold text-fg group-hover:text-brand">{p.name}</h3>
                  <p className="truncate text-xs text-muted">{p.location} · {DEV_PROJECT_TYPE_LABEL[p.projectType]}</p>
                </div>
                <DevStatusBadge status={p.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Metric label="Net sellable" value={`${formatNumber(p.netSellableLand)} m²`} />
                <Metric label="Lots" value={String(p.totalLots)} />
                <Metric label="Project cost" value={formatCurrency(p.totalProjectCost, p.currency)} />
                <Metric label="Revenue" value={formatCurrency(p.totalRevenue, p.currency)} />
                <Metric label="Profit" value={formatCurrency(p.totalProfit, p.currency)} accent />
                <Metric label="ROI" value={`${p.roiPct.toFixed(1)}%`} accent />
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-brand opacity-0 transition-opacity group-hover:opacity-100">
                Open workspace <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div className={`mt-0.5 font-semibold ${accent ? "text-emerald-700" : "text-fg"}`}>{value}</div>
    </div>
  );
}
