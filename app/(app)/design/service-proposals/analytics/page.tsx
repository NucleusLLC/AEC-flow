import Link from "next/link";
import { ArrowLeft, FileSignature, CircleDollarSign, Trophy, TrendingUp, Layers, CheckCircle2 } from "lucide-react";
import { getServiceProposalAnalytics } from "@/lib/data/service-proposals";
import { ProposalAnalyticsCharts } from "@/components/service-proposals/analytics-charts";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Proposal Analytics · AEC-flow" };

export default async function ServiceProposalAnalyticsPage() {
  const a = await getServiceProposalAnalytics();
  const money = (n: number) => formatCurrency(n, a.currency, { maximumFractionDigits: 0 });

  return (
    <div className="w-full space-y-6">
      <Link href="/design/service-proposals" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Service Proposals
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Proposal Analytics</h2>
        <p className="text-sm text-muted">Pipeline, win rate and proposed value across all service proposals.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Tile icon={FileSignature} label="Proposals" value={String(a.total)} />
        <Tile icon={CircleDollarSign} label="Proposed value" value={money(a.proposedValue)} />
        <Tile icon={Layers} label="Open value" value={money(a.openValue)} />
        <Tile icon={CheckCircle2} label="Accepted value" value={money(a.acceptedValue)} />
        <Tile icon={Trophy} label="Win rate" value={`${a.winRate}%`} />
        <Tile icon={TrendingUp} label="Avg proposal" value={money(a.avgValue)} />
      </div>

      <ProposalAnalyticsCharts
        pipeline={a.pipeline}
        byStatus={a.byStatus.map((s) => ({ name: s.name, value: s.count }))}
        byBasis={a.byBasis}
        valueByMonth={a.valueByMonth}
        currency={a.currency}
      />
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
      <div className="mt-1.5 text-xl font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}
