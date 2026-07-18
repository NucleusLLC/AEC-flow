import Link from "next/link";
import { Plus, FileStack, Send, Clock, ArrowRight } from "lucide-react";
import { listDeliverables, designSummary } from "@/lib/data/design";
import { DeliverableList } from "@/components/design/deliverable-list";
import { DISCIPLINE_LABEL, DISCIPLINE_SLUG, DISCIPLINES } from "@/lib/design/types";

export const metadata = { title: "Design Register · AEC-flow" };

export default async function DesignPage() {
  const [items, summary] = await Promise.all([listDeliverables(), designSummary()]);
  const statFor = (d: (typeof DISCIPLINES)[number]) =>
    summary.byDiscipline.find((s) => s.discipline === d) ?? { total: 0, issued: 0, draft: 0 };

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Design Register</h2>
          <p className="text-sm text-muted">Drawings &amp; design documents across all disciplines.</p>
        </div>
        <Link
          href="/design/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          Add deliverable
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile icon={FileStack} label="Deliverables" value={String(summary.total)} />
        <Tile icon={Send} label="Issued / approved" value={String(summary.issued)} />
        <Tile icon={Clock} label="In review" value={String(summary.inReview)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {DISCIPLINES.map((d) => {
          const s = statFor(d);
          return (
            <Link
              key={d}
              href={`/design/${DISCIPLINE_SLUG[d]}`}
              className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-fg">{DISCIPLINE_LABEL[d]}</span>
                <ArrowRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted">
                <span><span className="font-semibold text-fg">{s.total}</span> total</span>
                <span><span className="font-semibold text-fg">{s.issued}</span> issued</span>
                <span><span className="font-semibold text-fg">{s.draft}</span> draft</span>
              </div>
            </Link>
          );
        })}
      </div>

      <DeliverableList items={items} />
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
