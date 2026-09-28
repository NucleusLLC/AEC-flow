import Link from "next/link";
import { ArrowUpRight, Printer } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { formatDate } from "@/lib/format";
import type { ScheduleSummary } from "@/lib/integrations/schedule/adapter";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

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

export async function ProjectProgrammeStatusCard({
  summary,
  scheduleKey,
}: {
  summary: ScheduleSummary;
  /** Whatever this project's schedule is keyed by — its row id, or its project
   *  number for the demo seeds. Feeds the print route. */
  scheduleKey: string;
}) {
  const t = await getServerT();
  // No programme at all: say so once, and offer the way in. The Schedule picker
  // now lists projects without a programme, so the link lands somewhere useful.
  if (!summary.found || summary.taskCount === 0) {
    return (
      <Card>
        <CardHeader
          title={t("Programme status")}
          subtitle={t("Where the project stands against its plan")}
          action={
            <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              {t("Open Schedule")} <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="px-5 pb-5 text-sm text-muted">
          {t("No programme yet — build one in Schedule and the plan-versus-actual position appears here.")}
        </div>
      </Card>
    );
  }

  // Behind/ahead is read off the schedule's own variance, not re-derived here.
  const behind = summary.varianceDays < 0;
  const varianceText =
    summary.varianceDays === 0
      ? t("On plan")
      : fmt(
          t(
            Math.abs(summary.varianceDays) === 1
              ? behind
                ? "1 day behind"
                : "1 day ahead"
              : behind
                ? "{count} days behind"
                : "{count} days ahead",
          ),
          { count: Math.abs(summary.varianceDays) },
        );
  const slip =
    summary.baselineFinish && summary.forecastFinish && summary.forecastFinish !== summary.baselineFinish;

  return (
    <Card>
      <CardHeader
        title={t("Programme status")}
        subtitle={t("Where the project stands against its plan")}
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/print/schedule/${encodeURIComponent(scheduleKey)}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg"
            >
              <Printer className="h-3 w-3" /> {t("Print")}
            </Link>
            <Link href="/schedule" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              {t("Open programme")} <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        }
      />
      <div className="space-y-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={overallTone[summary.overall]}>{t(overallLabel[summary.overall])}</Badge>
          <span className="text-xs text-muted">{varianceText}</span>
          <span className="ml-auto text-[11px] text-faint">
            {fmt(t(summary.taskCount === 1 ? "1 task" : "{count} tasks"), { count: summary.taskCount })}
            {summary.criticalCount > 0 ? ` · ${fmt(t("{count} on the critical path"), { count: summary.criticalCount })}` : ""}
          </span>
        </div>

        {/* Planned against actual — the comparison the overall % could not show. */}
        <div className="space-y-2.5">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{t("Planned to date")}</span>
              <span className="font-medium tabular-nums text-fg">{summary.pctPlanned}%</span>
            </div>
            <ProgressBar value={summary.pctPlanned} className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted">{t("Actual")}</span>
              <span className="font-medium tabular-nums text-fg">{summary.pctActual}%</span>
            </div>
            <ProgressBar value={summary.pctActual} className="mt-1.5" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="SPI" value={summary.spi.toFixed(2)} sub={summary.spi >= 1 ? t("at or above plan") : t("below plan")} />
          <Metric label={t("Planned finish")} value={summary.plannedFinish ? formatDate(summary.plannedFinish) : "—"} />
          <Metric
            label={t("Baseline finish")}
            value={summary.baselineFinish ? formatDate(summary.baselineFinish) : "—"}
          />
          <Metric
            label={t("Forecast finish")}
            value={summary.forecastFinish ? formatDate(summary.forecastFinish) : "—"}
            sub={slip ? (behind ? t("later than baseline") : t("earlier than baseline")) : undefined}
          />
        </div>
      </div>
    </Card>
  );
}
