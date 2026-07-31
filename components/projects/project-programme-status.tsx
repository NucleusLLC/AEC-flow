import Link from "next/link";
import { ArrowUpRight, Printer } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import type { ScheduleSummary } from "@/lib/integrations/schedule/adapter";

/**
 * "Where we stand against the plan" for a project — beta wish: the overall
 * progress figure alone did not say whether the project is ahead or behind its
 * programme.
 *
 * Every number arrives from `getProjectScheduleSummary`, the READ-ONLY schedule
 * adapter, which in turn reuses the protected system's own `computeCpm` /
 * `computeScheduleHealth`. Nothing here recomputes a schedule figure — see
 * docs/protected-systems.md.
 */

const overallTone: Record<ScheduleSummary["overall"], "green" | "amber" | "red" | "slate"> = {
  "on-track": "green",
  watch: "amber",
  "at-risk": "red",
  empty: "slate",
};

const overallLabel: Record<ScheduleSummary["overall"], string> = {
  "on-track": "On track",
  watch: "Watch",
  "at-risk": "At risk",
  empty: "No tasks yet",
};

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{value}</div>
      {sub ? <div className="text-[11px] text-faint">{sub}</div> : null}
    </div>
  );
}

export function ProjectProgrammeStatusCard({
  summary,
  scheduleKey,
}: {
  summary: ScheduleSummary;
  /** Whatever this project's schedule is keyed by — its row id, or its project
   *  number for the demo seeds. Feeds the print route. */
  scheduleKey: string;
}) {
  // No programme at all: say so once, and offer the way in. The Schedule picker
  // now lists projects without a programme, so the link lands somewhere useful.
  if (!summary.found || summary.taskCount === 0) {
    return (
      <Card>
        <CardHeader
          title="Programme status"
          subtitle="Where the project stands against its plan"
          action={
            <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Open Schedule <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="px-5 pb-5 text-sm text-muted">
          No programme yet — build one in Schedule and the plan-versus-actual position appears here.
        </div>
      </Card>
    );
  }

  // Behind/ahead is read off the schedule's own variance, not re-derived here.
  const behind = summary.varianceDays < 0;
  const varianceText =
    summary.varianceDays === 0
      ? "On plan"
      : `${Math.abs(summary.varianceDays)} day${Math.abs(summary.varianceDays) === 1 ? "" : "s"} ${behind ? "behind" : "ahead"}`;
  const slip =
    summary.baselineFinish && summary.forecastFinish && summary.forecastFinish !== summary.baselineFinish;

  return (
    <Card>
      <CardHeader
        title="Programme status"
        subtitle="Where the project stands against its plan"
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/print/schedule/${encodeURIComponent(scheduleKey)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg"
            >
              <Printer className="h-3 w-3" /> Print
            </Link>
            <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Open programme <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={overallTone[summary.overall]}>{overallLabel[summary.overall]}</Badge>
          <span className="text-xs text-muted">{varianceText}</span>
          <span className="ml-auto text-[11px] text-faint">
            {summary.taskCount} task{summary.taskCount === 1 ? "" : "s"}
            {summary.criticalCount > 0 ? ` · ${summary.criticalCount} on the critical path` : ""}
          </span>
        </div>

        {/* Planned against actual — the comparison the overall % could not show. */}
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Planned to date</span>
              <span className="font-medium tabular-nums text-fg">{summary.pctPlanned}%</span>
            </div>
            <ProgressBar value={summary.pctPlanned} className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">Actual</span>
              <span className="font-medium tabular-nums text-fg">{summary.pctActual}%</span>
            </div>
            <ProgressBar value={summary.pctActual} className="mt-1.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="SPI" value={summary.spi.toFixed(2)} sub={summary.spi >= 1 ? "at or above plan" : "below plan"} />
          <Metric label="Planned finish" value={summary.plannedFinish ? formatDate(summary.plannedFinish) : "—"} />
          <Metric
            label="Baseline finish"
            value={summary.baselineFinish ? formatDate(summary.baselineFinish) : "—"}
          />
          <Metric
            label="Forecast finish"
            value={summary.forecastFinish ? formatDate(summary.forecastFinish) : "—"}
            sub={slip ? (behind ? "later than baseline" : "earlier than baseline") : undefined}
          />
        </div>
      </div>
    </Card>
  );
}
