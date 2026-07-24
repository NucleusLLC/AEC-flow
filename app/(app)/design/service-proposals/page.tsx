import Link from "next/link";
import { Plus, FileSignature, Send, CircleDollarSign, Trophy } from "lucide-react";
import {
  listServiceProposals,
  summarizeServiceProposals,
} from "@/lib/data/service-proposals";
import { ServiceProposalList } from "@/components/service-proposals/proposal-list";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Service Proposals · AEC-flow" };

export default async function ServiceProposalsPage() {
  const [proposals, summary] = await Promise.all([
    listServiceProposals(),
    summarizeServiceProposals(),
  ]);
  const money = (n: number) => formatCurrency(n, summary.currency, { maximumFractionDigits: 0 });

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Service Proposals</h2>
          <p className="text-sm text-muted">
            Professional fee proposals — percentage of construction cost, or fixed fee.
          </p>
        </div>
        <Link
          href="/design/service-proposals/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Proposal
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile icon={FileSignature} label="Proposals" value={String(summary.total)} />
        <Tile icon={Send} label="Open" value={String(summary.open)} />
        <Tile icon={CircleDollarSign} label="Open value" value={money(summary.openValue)} />
        <Tile icon={Trophy} label="Win rate" value={`${summary.winRate}%`} />
      </div>

      <ServiceProposalList proposals={proposals} />
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
