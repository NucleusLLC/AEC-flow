import Link from "next/link";
import { FileStack, Send, Clock, ArrowUpRight } from "lucide-react";
import { ModuleDashboard } from "@/components/modules/module-dashboard";
import { StatTile, StatSection } from "@/components/modules/stat-tile";
import { designSummary } from "@/lib/data/design";
import { DISCIPLINE_LABEL, DISCIPLINE_SLUG, DISCIPLINES } from "@/lib/design/types";

export const metadata = { title: "Module 1 Dashboard · AEC-flow" };

export default async function DesignModuleDashboard() {
  const summary = await designSummary();
  const statFor = (d: (typeof DISCIPLINES)[number]) =>
    summary.byDiscipline.find((s) => s.discipline === d) ?? { total: 0, issued: 0, draft: 0 };

  return (
    <ModuleDashboard moduleKey="design">
      <StatSection title="Design register">
        <StatTile icon={FileStack} label="Deliverables" value={String(summary.total)} href="/design" />
        <StatTile icon={Send} label="Issued / approved" value={String(summary.issued)} href="/design" />
        <StatTile icon={Clock} label="In review" value={String(summary.inReview)} href="/design" />
      </StatSection>

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">By discipline</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {DISCIPLINES.map((d) => {
            const s = statFor(d);
            return (
              <Link
                key={d}
                href={`/design/${DISCIPLINE_SLUG[d]}`}
                className="group rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-fg">{DISCIPLINE_LABEL[d]}</span>
                  <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-brand" />
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
      </div>
    </ModuleDashboard>
  );
}
