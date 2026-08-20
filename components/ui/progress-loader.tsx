"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  advanceLoadSignal,
  createLoadSignal,
  formatElapsed,
  isOverdue,
  progressPercent,
  shouldShowElapsed,
  stageBoundaries,
  type LoadSignal,
  type ProgressStage,
} from "@/lib/ui/progress-loader";

export { advanceLoadSignal, createLoadSignal };
export type { LoadSignal, ProgressStage };

/**
 * A determinate loader for waits the user actually feels.
 *
 * THE CONTRACT, AND WHY IT IS WORTH KEEPING
 * -----------------------------------------
 * The bar crosses a stage boundary ONLY when the caller tells it a stage
 * finished, and the caller only says that after awaiting something real. In
 * between, elapsed time eases the bar across at most 90% of the current stage's
 * span (SMOOTHER_CEILING in lib/ui/progress-loader.ts), so:
 *
 *   - it can never show 100% before the work is done, and
 *   - it can never march past a boundary the work has not reached.
 *
 * All the arithmetic lives in the pure module so it can be unit-tested; this
 * file owns the clock, the markup and nothing else.
 *
 * NEVER FROZEN. Three independent things keep it alive on a long wait: the bar
 * itself is still creeping (an exponential approach never stops moving), an
 * elapsed-seconds counter appears after 2.5s, and a "Still working…" line
 * appears once the stage passes 4x its median. The counter is plain text, so it
 * keeps ticking under `prefers-reduced-motion` when the sheen is switched off.
 *
 * WHY A MUTABLE `signal` INSTEAD OF PROPS. See the note on `LoadSignal`: the
 * estimate load runs inside `useTransition`, where a state update made after an
 * await is batched with the final one and never rendered on its own. The caller
 * mutates the signal; this component reads it on its next tick. That way the
 * caller's data flow is untouched — which matters, because the call site is a
 * protected file whose load semantics must not change.
 */
export function ProgressLoader({
  signal,
  stages,
  title,
  className,
  tick = 120,
}: {
  /** Mutable progress record owned by the caller. */
  signal: LoadSignal;
  /** The awaited steps, in order. */
  stages: ProgressStage[];
  /** Accessible name for the bar, e.g. "Loading estimate". */
  title: string;
  className?: string;
  /** Poll interval, ms. Small enough to feel live, large enough to be free. */
  tick?: number;
}) {
  // The only piece of React state here: the clock. It is sampled in an effect
  // rather than during render — reading `Date.now()` in a render body is impure
  // and React's lint rule rightly rejects it — and re-sampling it is also what
  // schedules the re-render. Everything on screen is derived from `signal` plus
  // this timestamp, so there is no second copy of the truth to fall out of sync.
  //
  // 0 means "not sampled yet": the first paint, one tick long, which is
  // legitimately 0% because the load has only just started. The first interval
  // fires `tick` ms later and the bar is live from then on. (The clock is not
  // also sampled synchronously on mount — setState in an effect body is a
  // cascading render, and one 120ms frame at 0% is not worth one.)
  const [now, setNow] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timer.current = setInterval(() => setNow(Date.now()), tick);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [tick]);

  const index = Math.max(0, Math.min(signal.stageIndex, stages.length - 1));
  const stage = stages[index];
  // Clamped at 0 for two reasons: the clock is sampled on a tick, so it can
  // trail a stage change by one interval and briefly read as "before this stage
  // started"; and a signal that was never started (stageStartedAt <= 0) must
  // read as "just begun", never as an epoch's worth of elapsed time — which the
  // smoother would otherwise turn into a bar sitting at 90% on no evidence.
  const started = signal.stageStartedAt > 0;
  const elapsedInStage = now === 0 || !started ? 0 : Math.max(0, now - signal.stageStartedAt);
  const pct = progressPercent({ stages, stageIndex: index, elapsedInStageMs: elapsedInStage });
  const rounded = Math.round(pct);
  const overdue = stage ? isOverdue(elapsedInStage, stage.medianMs) : false;
  const showElapsed = shouldShowElapsed(elapsedInStage);
  const stepLabel = `Step ${index + 1} of ${stages.length}`;

  // Ticks on the track at each boundary: they make the stage structure legible,
  // so a pause reads as "waiting on this step" rather than "stuck".
  const boundaries = stageBoundaries(stages).slice(1, -1);

  return (
    <div
      className={cn(
        // `card-surface` is the app's glass opt-in, so this panel gets the same
        // treatment as the cards around it on a photo background and stays a
        // plain surface everywhere else. Colours are tokens only.
        "card-surface flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-16",
        className,
      )}
    >
      <div className="w-full max-w-sm">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-fg">{title}</span>
          <span className="font-mono text-xs tabular-nums text-muted">{rounded}%</span>
        </div>

        <div
          role="progressbar"
          aria-label={title}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={rounded}
          aria-valuetext={`${rounded}% — ${stage?.label ?? title}`}
          className="relative h-2 w-full overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          >
            {/* Sheen: decoration only, and the CSS turns it off under
              * prefers-reduced-motion. The bar still advances without it. */}
            <div className="progress-sheen h-full w-full bg-gradient-to-r from-transparent via-brand-fg/40 to-transparent" />
          </div>
          {boundaries.map((b, i) => (
            <span
              key={stages[i]?.id ?? i}
              aria-hidden="true"
              className="absolute top-0 h-full w-px bg-surface/70"
              style={{ left: `${b * 100}%` }}
            />
          ))}
        </div>

        {/* Fixed height so the "Still working…" line cannot reflow the panel
          * when it appears or goes away. */}
        <div className="mt-2 flex min-h-[2.25rem] flex-col gap-0.5">
          <p aria-live="polite" className="text-xs text-muted">
            <span className="text-faint">{stepLabel} · </span>
            {stage?.label ?? title}
            {signal.detail ? <span className="text-faint"> · {signal.detail}</span> : null}
          </p>
          <p className="text-[11px] text-faint">
            {overdue ? "Still working — this is taking longer than usual. " : null}
            {showElapsed ? formatElapsed(elapsedInStage) : " "}
          </p>
        </div>
      </div>
    </div>
  );
}
