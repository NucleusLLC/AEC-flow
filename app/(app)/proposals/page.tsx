import Link from "next/link";
import { Plus, TrendingUp, Clock3, Trophy, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/proposals/ui";
import { ProposalsApp } from "@/components/proposals/proposals-app";
import { getProposalRecords, summarizeProposals } from "@/lib/data/proposals";
import { formatCurrencyCompact } from "@/lib/format";

export const metadata = { title: "Proposals · ZenArch" };

export default async function ProposalsPage() {
  const proposals = await getProposalRecords();
  const summary = summarizeProposals(proposals);

  const tiles = [
    {
      label: "Open Pipeline",
      value: formatCurrencyCompact(summary.openValue),
      hint: `${summary.openCount} live proposals`,
      icon: TrendingUp,
      accent: "text-brand",
    },
    {
      label: "Awaiting Approval",
      value: formatCurrencyCompact(summary.awaitingValue),
      hint: `${summary.awaitingCount} pending decision`,
      icon: Clock3,
      accent: "text-amber-600",
    },
    {
      label: "Won to Date",
      value: formatCurrencyCompact(summary.wonValue),
      hint: "approved fee value",
      icon: Trophy,
      accent: "text-emerald-600",
    },
    { label: "Win Rate", value: `${summary.winRate}%`, hint: "approved vs decided", icon: Percent, accent: "text-violet-600" },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeading
        title="Proposals"
        subtitle="Fee proposals from draft to approval — pipeline value, follow-ups, and win rate."
      >
        <Link
          href="/proposals/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          New Proposal
        </Link>
      </PageHeading>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Card key={t.label} className="p-5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">{t.label}</div>
                <Icon className={`h-4 w-4 ${t.accent}`} />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-fg">{t.value}</div>
              <div className="mt-1 text-xs text-faint">{t.hint}</div>
            </Card>
          );
        })}
      </div>

      <ProposalsApp proposals={proposals} />
    </div>
  );
}
