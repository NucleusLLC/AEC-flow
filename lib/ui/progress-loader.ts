/**
 * Honest progress: the arithmetic behind <ProgressLoader />.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * A progress bar that fills on a timer is a lie, and users learn to distrust it.
 * Everything here is built so that the only thing that can move the bar PAST a
 * boundary is a real event the caller actually observed. Between those events a
 * smoother keeps the bar alive, but it is mathematically incapable of reaching
 * the next boundary — so a slow stage eases toward the boundary and stops there
 * instead of sitting at 100% while nothing appears.
 *
 * Pure: no React, no I/O, no timers. The component owns the clock; this module
 * only turns (stages, which stage, how long we have been in it) into a number.
 *
 * THE TWO KINDS OF NUMBER, AND WHICH IS WHICH
 * -------------------------------------------
 *   MEASURED  — a completed stage. `stageIndex` only ever advances because the
 *               caller awaited something and it came back. That part of the bar
 *               is fact.
 *   ESTIMATED — the movement *within* the current stage. It is elapsed time
 *               against that stage's median, and it is capped (see
 *               SMOOTHER_CEILING) so it can never be mistaken for fact.
 *
 * Every `medianMs` below carries a comment saying whether the number was
 * measured or guessed. Keep that habit.
 */

/** One awaited step of a load. `medianMs` is how long this step usually takes. */
export interface ProgressStage {
  /** Stable key — used for React keys and for tests. */
  id: string;
  /** Shown to the user while this stage is the current one. Short, plain. */
  label: string;
  /**
   * Typical duration of this stage, in ms. It does two jobs:
   *   1. it sets the stage's WEIGHT — a stage that usually takes twice as long
   *      owns twice as much of the bar, so the bar moves at a roughly even rate;
   *   2. it scales the within-stage smoother (see `smootherFraction`).
   * It is a typical duration, never a deadline: overrunning it is handled, not
   * punished.
   */
  medianMs: number;
}

/**
 * How much of the CURRENT stage's span the time-based smoother is allowed to
 * cover. 0.9 means a stage that overruns forever eases to 90% of its own span
 * and stops, always short of the next boundary.
 *
 * This single constant is what guarantees the bar can never reach 100% before
 * the work is done: the final stage's span is the last slice of the bar, and
 * 90% of it still leaves a visible remainder.
 */
export const SMOOTHER_CEILING = 0.9;

/**
 * Half-life convention for the smoother: at exactly `medianMs` elapsed, the bar
 * sits half way through the stage's span. Half the time you are already done by
 * then, so half the span is the honest place to be. Past that it keeps rising
 * with an ever-smaller step (75% of the span at 2x median, 87.5% at 3x) until it
 * meets SMOOTHER_CEILING.
 */
const LN2 = Math.LN2;

/** Elapsed time is only shown once a wait is long enough to be worth counting. */
export const SHOW_ELAPSED_AFTER_MS = 2_500;

/** Floor for "this is taking longer than usual" — never nag before this. */
export const OVERDUE_FLOOR_MS = 5_000;

/** A stage is "overdue" once it has run this many times its own median. */
const OVERDUE_MEDIAN_MULTIPLE = 4;

/**
 * Cumulative fractions marking where each stage starts and ends, from 0 to 1.
 * Length is `stages.length + 1`. Weights come from the medians, so nobody has
 * to keep a hand-written weight list in sync with a timing they just measured.
 *
 * Degenerate input (no stages, or all medians <= 0) falls back to an even split,
 * which is still monotonic and still ends at exactly 1.
 */
export function stageBoundaries(stages: ProgressStage[]): number[] {
  if (stages.length === 0) return [0, 1];
  const durations = stages.map((s) => (Number.isFinite(s.medianMs) && s.medianMs > 0 ? s.medianMs : 0));
  const total = durations.reduce((a, b) => a + b, 0);
  const weights = total > 0 ? durations.map((d) => d / total) : durations.map(() => 1 / stages.length);

  const out = [0];
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    // The last entry is pinned to exactly 1 so floating-point drift can never
    // leave a sliver of bar that no stage owns.
    out.push(i === weights.length - 1 ? 1 : acc);
  }
  return out;
}

/**
 * Fraction of the current stage's span the smoother has covered: 0 at t=0,
 * rising toward SMOOTHER_CEILING and never beyond. See LN2 for the curve.
 */
export function smootherFraction(elapsedMs: number, medianMs: number): number {
  if (!(elapsedMs > 0)) return 0;
  // No usable median: give the stage its floor and let the completion event do
  // the rest. Never assume a stage is nearly finished on no evidence.
  if (!(medianMs > 0)) return 0;
  const raw = 1 - Math.exp((-LN2 * elapsedMs) / medianMs);
  return Math.min(raw, SMOOTHER_CEILING);
}

export interface ProgressInput {
  stages: ProgressStage[];
  /**
   * How many stages are FINISHED. 0 = still in the first stage. It is also the
   * index of the stage now running. Only ever advanced by an observed event.
   */
  stageIndex: number;
  /** Milliseconds since the current stage started. */
  elapsedInStageMs: number;
  /** The whole job is finished. This is the ONLY way to reach 100. */
  done?: boolean;
}

/**
 * The number on screen, 0-100.
 *
 * floor  = sum of the weights of stages that actually completed  -> measured.
 * motion = the current stage's span x the capped smoother        -> estimated.
 *
 * With `done` false the result is strictly less than 100 for every possible
 * input; `progress-loader.test.ts` asserts that rather than trusting the reading.
 */
export function progressPercent({ stages, stageIndex, elapsedInStageMs, done = false }: ProgressInput): number {
  if (done) return 100;
  if (stages.length === 0) return 0;
  const bounds = stageBoundaries(stages);
  // Clamp rather than throw: a loader must never crash the screen it is covering.
  const i = Math.max(0, Math.min(stageIndex, stages.length - 1));

  const floor = bounds[i];
  const span = bounds[i + 1] - floor;
  const pct = (floor + span * smootherFraction(elapsedInStageMs, stages[i].medianMs)) * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Is this stage running long? Used for the "Still working…" line, whose whole
 * job is to prove the screen is not dead. Deliberately generous: four times the
 * median AND at least five seconds, so a fast machine never sees it.
 */
export function isOverdue(elapsedInStageMs: number, medianMs: number): boolean {
  const threshold = Math.max(OVERDUE_FLOOR_MS, OVERDUE_MEDIAN_MULTIPLE * (medianMs > 0 ? medianMs : 0));
  return elapsedInStageMs > threshold;
}

/** Should the elapsed-seconds counter be on screen yet? */
export function shouldShowElapsed(elapsedMs: number): boolean {
  return elapsedMs >= SHOW_ELAPSED_AFTER_MS;
}

/** "6s" / "1m 04s". Whole seconds — a loader is not a stopwatch. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/* ------------------------------------------------------------------------- *
 * The signal
 * ------------------------------------------------------------------------- */

/**
 * A mutable record of what the load has actually achieved so far.
 *
 * WHY MUTABLE, AND NOT REACT STATE. The estimate load runs inside
 * `useTransition`. A state update made after an `await` inside a transition is
 * itself a transition update, so React batches "stage 1 finished" together with
 * "here is the sheet" and the intermediate render is never committed — the
 * stage change would be invisible, which is exactly the complaint this feature
 * exists to fix. So the caller mutates this object, and <ProgressLoader /> —
 * which is already ticking for the elapsed-time display — reads it on its next
 * tick. Worst-case lag is one tick (~120ms), and the caller's data flow, its
 * state, and its error handling are all left exactly as they were.
 */
export interface LoadSignal {
  /** Stages completed so far; also the index of the stage now running. */
  stageIndex: number;
  /** `Date.now()` when the current stage started. */
  stageStartedAt: number;
  /** Optional measured fact about the payload, e.g. "19 sections · 113 lines". */
  detail?: string;
}

export function createLoadSignal(now: number = Date.now()): LoadSignal {
  return { stageIndex: 0, stageStartedAt: now };
}

/**
 * Record that a stage finished. Ignores anything that would move the signal
 * backwards, so a late or duplicated call cannot make the bar retreat.
 */
export function advanceLoadSignal(
  signal: LoadSignal,
  toStageIndex: number,
  detail?: string,
  now: number = Date.now(),
): LoadSignal {
  if (detail !== undefined) signal.detail = detail;
  if (toStageIndex <= signal.stageIndex) return signal;
  signal.stageIndex = toStageIndex;
  signal.stageStartedAt = now;
  return signal;
}

/* ------------------------------------------------------------------------- *
 * Stage presets
 * ------------------------------------------------------------------------- */

/**
 * Opening a saved estimate. Two stages, because two things are genuinely
 * awaited and there is no honest way to manufacture a third: the server action
 * is one round trip, and splitting it would change what is fetched.
 *
 * WHERE THE NUMBERS COME FROM — measured 2026-08-20 against the largest known
 * sheet, `cmrh1s7zs000004l410azeses`: 19 sections, 113 line items, 378,822
 * bytes of JSON once serialised. Seven consecutive `getEstimateById()` calls
 * through the real data-access layer gave 2652, 764, 391, 396, 390, 394, 397 ms
 * — median 396 ms warm; the 2652 ms outlier is the first query on a cold
 * connection pool.
 *
 *   fetch  900 ms — PART MEASURED. 396 ms of it is the measured warm median for
 *                   the database read plus DTO mapping. The remaining ~500 ms is
 *                   an ESTIMATE of the server-action round trip around it (POST,
 *                   RSC serialisation of 379 KB, transfer); it could not be
 *                   measured because no browser automation was available in this
 *                   environment. If you can measure it, correct this number —
 *                   nothing else has to change.
 *   render 350 ms — ESTIMATED, not measured. React committing a 113-row sheet.
 *                   Same reason: it needs a real browser to time.
 *
 * These medians only set the pace and the split of the bar. Getting them wrong
 * makes the bar uneven; it cannot make it dishonest, because a boundary is still
 * only crossed when the awaited thing actually returns.
 */
export const OPEN_ESTIMATE_STAGES: ProgressStage[] = [
  { id: "fetch", label: "Loading sheet from the server", medianMs: 900 },
  { id: "render", label: "Preparing sections", medianMs: 350 },
];
