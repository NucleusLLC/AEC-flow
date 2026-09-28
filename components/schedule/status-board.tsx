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
import {
  countVisibleTiles,
  defaultDisplayPrefs,
  tileGridClass,
  type DisplayPrefs,
} from "@/lib/schedule/display-prefs";
import type { ScheduleHealth, TaskHealth } from "@/lib/data/schedule";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

// Light mode keeps the original soft tints; dark mode uses deep tints (the
// critical state is a burgundy red) so the strip isn't a washed-out light box.
const OVERALL = {
  "on-track": {
    label: "ON TRACK",
    ring: "border-emerald-500",
    chip: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-200",
    bg: "bg-emerald-50 dark:bg-emerald-950",
    Icon: ShieldCheck,
  },
  watch: {
    label: "SCHEDULE WATCH",
    ring: "border-amber-500",
    chip: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-200",
    bg: "bg-amber-50 dark:bg-amber-950",
    Icon: Shield,
  },
  "at-risk": {
    label: "CRITICAL PATH AT RISK",
    ring: "border-red-500",
    chip: "bg-red-500",
    text: "text-red-700 dark:text-rose-100",
    bg: "bg-red-50 dark:bg-rose-950",
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

// PROTECTED SYSTEM (schedule) — display/chrome change, approved 2026-08-04.
//
// `display` decides which readouts are PAINTED. It is threaded no further than
// the JSX below on purpose: `health` still arrives fully computed, every tile's
// value is still derived on every render, and hiding one removes a `<div>` and
// nothing else. No calculation may ever be put behind one of these flags — a
// board with SPI hidden and a board with SPI shown must agree on the numbers.
//
// It is optional and defaults to all-on so the print renderer and any future
// caller that has no opinion get the original board unchanged.
export function StatusBoard({
  health,
  statusDate,
  onStatusDate,
  display,
}: {
  health: ScheduleHealth;
  statusDate: string;
  onStatusDate: (iso: string) => void;
  display?: DisplayPrefs;
}) {
  const t = useT();
  const show = display ?? defaultDisplayPrefs();
  const visibleTiles = countVisibleTiles(show);
  const o = OVERALL[health.overall];
  const culprit = health.attention.find((a) => a.isCritical) ?? health.attention[0] ?? null;
  const spiTone =
    health.spi >= 1 ? "text-emerald-600" : health.spi >= 0.9 ? "text-amber-600" : "text-red-600";
  const varTone =
    health.varianceDays >= 0 ? "text-emerald-600" : "text-red-600";

  const headline =
    health.overall === "at-risk"
      ? `${fmt(
          t(health.finishSlipDays === 1 ? "Forecast finish slips 1 day" : "Forecast finish slips {count} days"),
          { count: health.finishSlipDays },
        )}${culprit ? ` · ${culprit.name}` : ""}`
      : health.overall === "watch"
        ? fmt(
            t(
              health.behindCount + health.overdueCount === 1
                ? "1 task behind plan — critical path still nominal"
                : "{count} tasks behind plan — critical path still nominal",
            ),
            { count: health.behindCount + health.overdueCount },
          )
        : fmt(t("Critical path nominal · {pct}% complete"), { pct: Math.round(health.pctActual) });

  return (
    <Card className="overflow-hidden">
      {/* Status strip */}
      <div className={cn("flex flex-wrap items-center gap-3 border-l-4 px-4 py-3", o.ring, o.bg)}>
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-white", o.chip)}>
          <o.Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className={cn("font-mono text-sm font-bold tracking-wide", o.text)}>
            {t(o.label)}
          </div>
          <div className="text-xs text-fg">{headline}</div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted" />
          <span className="text-[11px] font-medium text-muted">{t("Status date")}</span>
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
            {t("Today")}
          </button>
        </div>
      </div>

      {/* Metric tiles — the grid is sized to what survives the Display Control
        * filter, not to the six tiles written below, so hiding four does not
        * leave four gaps. Dropped entirely at zero: an empty `p-4` band reads as
        * a rendering fault rather than as a deliberately quiet board. */}
      {visibleTiles > 0 ? (
        <div className={cn("grid gap-3 p-4", tileGridClass(visibleTiles))}>
          {show.actualPlanned ? (
            <Tile
              label={t("Actual / Planned")}
              value={`${Math.round(health.pctActual)}% / ${Math.round(health.pctPlanned)}%`}
              sub={t("duration-weighted")}
            />
          ) : null}
          {show.spi ? (
            <Tile label="SPI" value={health.spi.toFixed(2)} sub={t("earned ÷ planned")} tone={spiTone} />
          ) : null}
          {show.scheduleVariance ? (
            <Tile
              label={t("Schedule variance")}
              value={`${health.varianceDays >= 0 ? "+" : ""}${health.varianceDays}d`}
              sub={health.varianceDays >= 0 ? t("ahead of plan") : t("behind plan")}
              tone={varTone}
            />
          ) : null}
          {show.behindOverdue ? (
            <Tile
              label={t("Behind / Overdue")}
              value={`${health.behindCount} / ${health.overdueCount}`}
              sub={fmt(t("{done}/{total} done"), { done: health.doneCount, total: health.total })}
              tone={health.behindCount + health.overdueCount > 0 ? "text-red-600" : "text-fg"}
            />
          ) : null}
          {show.baselineFinish ? (
            <Tile
              label={t("Baseline finish")}
              value={formatDate(health.baselineFinish)}
              sub={t("planned completion")}
            />
          ) : null}
          {show.forecast ? (
            <Tile
              label={t("Forecast finish")}
              value={formatDate(health.forecastFinish)}
              sub={
                health.finishSlipDays > 0 ? fmt(t("+{count}d slip"), { count: health.finishSlipDays }) : t("on baseline")
              }
              tone={health.finishSlipDays > 0 ? "text-red-600" : "text-emerald-600"}
            />
          ) : null}
        </div>
      ) : null}

      {/* Critical path callout + attention list */}
      <div className="border-t border-border px-4 py-3">
        {/* "Critical Path Slipping" hides this callout — the heading and the
          * Slipping/Nominal badge. The attention list below it stays: it is the
          * behind/overdue roster, a different readout that the owner's list
          * never named, and it is what makes this band worth its border. */}
        {show.criticalPathSlipping ? (
          <div className="mb-2 flex items-center gap-2">
            <Crosshair className={cn("h-4 w-4", health.criticalSlipDays > 0 ? "text-red-600" : "text-emerald-600")} />
            <span className="text-sm font-semibold text-fg">{t("Critical Path Status")}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                health.criticalSlipDays > 0
                  ? "bg-red-100 text-red-700"
                  : "bg-emerald-100 text-emerald-700",
              )}
            >
              {health.criticalSlipDays > 0 ? fmt(t("Slipping {count}d"), { count: health.finishSlipDays }) : t("Nominal")}
            </span>
          </div>
        ) : null}

        {health.attention.length === 0 ? (
          <p className="text-xs text-muted">{fmt(t("All tasks at or ahead of plan as of {date}."), { date: formatDate(statusDate) })} ✅</p>
        ) : (
          <ul className="space-y-1">
            {health.attention.slice(0, 6).map((h) => (
              <AttentionRow key={h.id} h={h} />
            ))}
            {health.attention.length > 6 ? (
              <li className="pt-1 text-[11px] text-faint">
                {fmt(t("+{count} more behind / overdue"), { count: health.attention.length - 6 })}
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </Card>
  );
}

function AttentionRow({ h }: { h: TaskHealth }) {
  const t = useT();
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
        {overdue ? fmt(t("{count}d overdue"), { count: h.daysOverdue }) : fmt(t("{count}d behind"), { count: h.daysBehind })}
      </span>
    </li>
  );
}
