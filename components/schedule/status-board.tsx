"use client";

import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  Crosshair,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ScheduleHealth, TaskHealth } from "@/lib/data/schedule";

// Dark-tinted alert strips so they read correctly in dark mode (the critical
// state is a deep burgundy red, not a washed-out light pink).
const OVERALL = {
  "on-track": {
    label: "ON TRACK",
    ring: "border-emerald-500",
    chip: "bg-emerald-600",
    text: "text-emerald-200",
    bg: "bg-emerald-950",
    Icon: ShieldCheck,
  },
  watch: {
    label: "SCHEDULE WATCH",
    ring: "border-amber-500",
    chip: "bg-amber-500",
    text: "text-amber-200",
    bg: "bg-amber-950",
    Icon: Shield,
  },
  "at-risk": {
    label: "CRITICAL PATH AT RISK",
    ring: "border-red-600",
    chip: "bg-red-600",
    text: "text-rose-100",
    bg: "bg-rose-950",
    Icon: ShieldAlert,
  },
} as const;

function Tile({
  label,
  value,
  sub,
  tone = "text-fg",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-faint">{label}</div>
      <div className={cn("mt-1 font-mono text-lg font-semibold tabular-nums", tone)}>{value}</div>
      {sub ? <div className="text-[10px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function StatusBoard({
  health,
  statusDate,
  onStatusDate,
}: {
  health: ScheduleHealth;
  statusDate: string;
  onStatusDate: (iso: string) => void;
}) {
  const o = OVERALL[health.overall];
  const culprit = health.attention.find((a) => a.isCritical) ?? health.attention[0] ?? null;
  const spiTone =
    health.spi >= 1 ? "text-emerald-600" : health.spi >= 0.9 ? "text-amber-600" : "text-red-600";
  const varTone =
    health.varianceDays >= 0 ? "text-emerald-600" : "text-red-600";

  const headline =
    health.overall === "at-risk"
      ? `Forecast finish slips ${health.finishSlipDays} day${health.finishSlipDays === 1 ? "" : "s"}${
          culprit ? ` · ${culprit.name}` : ""
        }`
      : health.overall === "watch"
        ? `${health.behindCount + health.overdueCount} task${
            health.behindCount + health.overdueCount === 1 ? "" : "s"
          } behind plan — critical path still nominal`
        : `Critical path nominal · ${Math.round(health.pctActual)}% complete`;

  return (
    <Card className="overflow-hidden">
      {/* Status strip */}
      <div className={cn("flex flex-wrap items-center gap-3 border-l-4 px-4 py-3", o.ring, o.bg)}>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", o.chip)}>
          <o.Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className={cn("font-mono text-sm font-bold tracking-wide", o.text)}>
            {o.label}
          </div>
          <div className="text-xs text-white/75">{headline}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted" />
          <span className="text-[11px] font-medium text-muted">Status date</span>
          <input
            type="date"
            value={statusDate}
            onChange={(e) => onStatusDate(e.target.value)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
          <button
            type="button"
            onClick={() => onStatusDate(new Date().toISOString().slice(0, 10))}
            className="h-8 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2"
          >
            Today
          </button>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Tile
          label="Actual / Planned"
          value={`${Math.round(health.pctActual)}% / ${Math.round(health.pctPlanned)}%`}
          sub="duration-weighted"
        />
        <Tile label="SPI" value={health.spi.toFixed(2)} sub="earned ÷ planned" tone={spiTone} />
        <Tile
          label="Schedule variance"
          value={`${health.varianceDays >= 0 ? "+" : ""}${health.varianceDays}d`}
          sub={health.varianceDays >= 0 ? "ahead of plan" : "behind plan"}
          tone={varTone}
        />
        <Tile
          label="Behind / Overdue"
          value={`${health.behindCount} / ${health.overdueCount}`}
          sub={`${health.doneCount}/${health.total} done`}
          tone={health.behindCount + health.overdueCount > 0 ? "text-red-600" : "text-fg"}
        />
        <Tile
          label="Baseline finish"
          value={formatDate(health.baselineFinish)}
          sub="planned completion"
        />
        <Tile
          label="Forecast finish"
          value={formatDate(health.forecastFinish)}
          sub={
            health.finishSlipDays > 0 ? `+${health.finishSlipDays}d slip` : "on baseline"
          }
          tone={health.finishSlipDays > 0 ? "text-red-600" : "text-emerald-600"}
        />
      </div>

      {/* Critical path callout + attention list */}
      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <Crosshair className={cn("h-4 w-4", health.criticalSlipDays > 0 ? "text-red-600" : "text-emerald-600")} />
          <span className="text-sm font-semibold text-fg">Critical Path Status</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              health.criticalSlipDays > 0
                ? "bg-red-100 text-red-700"
                : "bg-emerald-100 text-emerald-700",
            )}
          >
            {health.criticalSlipDays > 0 ? `Slipping ${health.finishSlipDays}d` : "Nominal"}
          </span>
        </div>

        {health.attention.length === 0 ? (
          <p className="text-xs text-muted">All tasks at or ahead of plan as of {formatDate(statusDate)}. ✅</p>
        ) : (
          <ul className="space-y-1">
            {health.attention.slice(0, 6).map((h) => (
              <AttentionRow key={h.id} h={h} />
            ))}
            {health.attention.length > 6 ? (
              <li className="pt-1 text-[11px] text-faint">
                +{health.attention.length - 6} more behind / overdue
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </Card>
  );
}

function AttentionRow({ h }: { h: TaskHealth }) {
  const overdue = h.state === "overdue";
  return (
    <li className="flex items-center gap-2 text-xs">
      <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", overdue ? "text-red-600" : "text-amber-600")} />
      {h.isCritical ? (
        <span className="rounded bg-red-600 px-1 py-0.5 text-[9px] font-bold uppercase text-white">CP</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-medium text-fg">{h.name}</span>
      <span className="font-mono text-[11px] text-muted">
        {h.actualPct}% / {h.expectedPct}%
      </span>
      <span className={cn("w-20 text-right font-mono text-[11px]", overdue ? "text-red-600" : "text-amber-600")}>
        {overdue ? `${h.daysOverdue}d overdue` : `${h.daysBehind}d behind`}
      </span>
    </li>
  );
}
