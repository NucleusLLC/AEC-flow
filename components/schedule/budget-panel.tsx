"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  CircleDollarSign,
  Coins,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  assignCommitmentAction,
  loadScheduleBudgetAction,
  type ScheduleBudgetData,
} from "@/app/(app)/schedule/budget-actions";
import {
  parseBudgetInput,
  reconcileEstimate,
  rollupBudget,
  sumEstimateLines,
  toMajor,
  type BudgetRollup,
  type BudgetRow,
  type BudgetTask,
  type EstimateReconciliation,
  type Money,
} from "@/lib/schedule/budget";

/**
 * Budget on the schedule — BUDGET vs COMMITTED vs RECEIVED, per activity.
 *
 * PROTECTED SYSTEM (schedule) — new panel behind the existing Budget toggle,
 * approved 2026-08-04.
 *
 * Its own file, like display-control.tsx, so the Gantt gains one conditional render and
 * nothing else. schedule-gantt.tsx is already ~1500 lines of timeline geometry; a cost
 * table living inside it would be a second reason for that file to change.
 *
 * NO MONEY ARITHMETIC HERE. Every figure on screen comes out of `lib/schedule/budget.ts`
 * already added up; this file formats and paints. The only numbers it touches are the
 * ones it hands to `parseBudgetInput`. That rule is what guarantees the panel and any
 * server-side total can never quietly disagree.
 *
 * WHAT IT IS NOT. No earned value, no CPI, no S-curve. Three columns.
 */

/** The task shape the panel needs — the ordered, indented rows the Gantt already built. */
export interface BudgetPanelTask extends BudgetTask {
  depth: number;
  budgetRef?: string | null;
}

/** A budget edit, handed back to the Gantt to fold into its task list. The panel owns
 *  no schedule state — the programme stays the single source of truth and the existing
 *  Save button is what persists it. */
export interface BudgetChange {
  amount: number | null;
  source: "manual" | "estimate" | null;
  ref: string | null;
}

export type BudgetChangeHandler = (taskId: string, change: BudgetChange) => void;

const numberCell = "px-3 py-2 text-right font-mono text-sm tabular-nums";
const headCell = "px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-faint";

export function BudgetPanel({
  projectId,
  tasks,
  onBudgetChange,
  onHide,
}: {
  projectId: string;
  tasks: BudgetPanelTask[];
  onBudgetChange: BudgetChangeHandler;
  onHide: () => void;
}) {
  const [data, setData] = useState<ScheduleBudgetData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [assignPending, startAssign] = useTransition();
  const [assignError, setAssignError] = useState<string | null>(null);

  const apply = useCallback((res: Awaited<ReturnType<typeof loadScheduleBudgetAction>>) => {
    if (res.ok) {
      setData(res.data);
      setLoadError(null);
    } else {
      setLoadError(res.error);
    }
    setLoading(false);
  }, []);

  // Loaded when the panel mounts — i.e. the first time the toggle is switched on —
  // rather than with the schedule, so an uncosted programme pays nothing for this.
  //
  // The effect starts the request and nothing else: `loading` already begins true, so
  // no state is set synchronously in the body (react-hooks/set-state-in-effect), and the
  // `alive` flag drops a response that arrives after the toggle was switched back off.
  useEffect(() => {
    let alive = true;
    void loadScheduleBudgetAction(projectId).then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [projectId, apply]);

  /** Re-read from the server. Event-handler path only (retry, and after an assignment). */
  const reload = useCallback(async () => {
    setLoading(true);
    apply(await loadScheduleBudgetAction(projectId));
  }, [projectId, apply]);

  const currency = data?.currency ?? "";

  const rollup = useMemo(() => {
    if (!data) return null;
    return rollupBudget({ tasks, commitments: data.commitments, currency: data.currency });
  }, [data, tasks]);

  const reconciliation = useMemo(() => {
    if (!data || !data.estimate.found || data.estimate.currencyMismatch) return null;
    return reconcileEstimate({
      tasks,
      grandTotal: data.estimate.grandTotal,
      direct: data.estimate.direct,
      currency: data.currency,
    });
  }, [data, tasks]);

  const money = useCallback(
    (m: Money | null) =>
      m === null ? "—" : formatCurrency(toMajor(m), m.currency, { maximumFractionDigits: 2 }),
    [],
  );

  const depthOf = useMemo(() => new Map(tasks.map((t) => [t.id, t.depth])), [tasks]);

  function assign(purchaseOrderId: string, taskKey: string | null) {
    setAssignError(null);
    startAssign(async () => {
      const res = await assignCommitmentAction({ purchaseOrderId, projectId, taskKey });
      if (!res.ok) {
        setAssignError(res.error);
        return;
      }
      // Re-read rather than patch local state: the rollup must always reflect what the
      // database actually holds, not what this browser believes it wrote.
      await reload();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <CircleDollarSign className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-fg">Cost-loaded schedule</div>
          <p className="text-xs text-muted">
            Budget from the Cost Estimate, committed and received from purchase orders.
          </p>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="ml-auto rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Hide
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-5 py-8 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading budget…
        </div>
      ) : loadError ? (
        <div className="flex flex-wrap items-center gap-3 px-5 py-8 text-sm text-red-600">
          <AlertTriangle className="h-4 w-4" /> {loadError}
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <RotateCcw className="mr-1 inline h-3 w-3" /> Retry
          </button>
        </div>
      ) : data && rollup ? (
        <>
          {/* Estimate baseline — the source the budget column is meant to come from. */}
          <EstimateStrip data={data} reconciliation={reconciliation} money={money} />

          {/* The three columns. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-left">
                  <th scope="col" className={cn(headCell, "text-left")}>
                    Activity
                  </th>
                  <th scope="col" className={cn(headCell, "text-right")}>
                    Budget
                  </th>
                  <th scope="col" className={cn(headCell, "text-right")}>
                    Committed
                  </th>
                  <th scope="col" className={cn(headCell, "text-right")} title="Value of goods received against purchase orders. This application records no vendor invoices or payments, so this is not 'spent'.">
                    Received
                  </th>
                  <th scope="col" className={cn(headCell, "text-right")}>
                    Variance
                  </th>
                </tr>
              </thead>
              <tbody>
                {rollup.rows.map((row) => (
                  <TaskRow
                    key={row.taskId}
                    row={row}
                    depth={depthOf.get(row.taskId) ?? 0}
                    money={money}
                    hasEstimate={data.estimate.found && !data.estimate.currencyMismatch}
                    pickerOpen={pickerFor === row.taskId}
                    onOpenPicker={() => setPickerFor(pickerFor === row.taskId ? null : row.taskId)}
                    onChange={onBudgetChange}
                  />
                ))}
                {rollup.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                      This programme has no activities yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-surface-2 font-semibold">
                  <td className="px-3 py-2 text-sm text-fg">
                    Total
                    {rollup.totals.tasksWithoutBudget > 0 ? (
                      <span className="ml-2 text-[11px] font-normal text-muted">
                        {rollup.totals.tasksWithoutBudget} of {rollup.totals.tasksTotal}{" "}
                        {rollup.totals.tasksTotal === 1 ? "activity has" : "activities have"} no budget
                        set
                      </span>
                    ) : null}
                  </td>
                  <td className={numberCell}>{money(rollup.totals.budget)}</td>
                  <td className={numberCell}>{money(rollup.totals.committed)}</td>
                  <td className={numberCell}>{money(rollup.totals.received)}</td>
                  <td className={cn(numberCell, varianceTone(rollup.totals.variance))}>
                    {money(rollup.totals.variance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* The estimate-line picker for whichever activity asked for it. */}
          {pickerFor ? (
            <EstimatePicker
              // Keyed by activity so switching tasks REMOUNTS the picker and its initial
              // selection is simply useState's initial value. Syncing that with an effect
              // would be a setState-in-effect cascade for no gain.
              key={pickerFor}
              lines={data.estimate.lines}
              currency={currency}
              task={tasks.find((t) => t.id === pickerFor) ?? null}
              onApply={(amount, ref) => {
                if (pickerFor) onBudgetChange(pickerFor, { amount, source: "estimate", ref });
                setPickerFor(null);
              }}
              onClose={() => setPickerFor(null)}
            />
          ) : null}

          {/* Money that is real but not on a task. Never spread, never dropped. */}
          <Buckets
            rollup={rollup}
            tasks={tasks}
            money={money}
            pending={assignPending}
            error={assignError}
            onAssign={assign}
          />

          <p className="border-t border-border px-5 py-3 text-[11px] leading-relaxed text-faint">
            <strong className="font-semibold text-muted">Committed</strong> is the full value of
            purchase orders that have been issued (drafts and cancellations are excluded).{" "}
            <strong className="font-semibold text-muted">Received</strong> is the value of goods
            actually received against them, with tax and shipping apportioned pro-rata — this
            application records no vendor invoices or payments, so it is deliberately not called
            &ldquo;spent&rdquo;. Budgets are saved with the programme; use{" "}
            <strong className="font-semibold text-muted">Save</strong> above.
          </p>
        </>
      ) : null}
    </Card>
  );
}

/* ── Estimate baseline strip ───────────────────────────────────────────────── */

function EstimateStrip({
  data,
  reconciliation,
  money,
}: {
  data: ScheduleBudgetData;
  reconciliation: EstimateReconciliation | null;
  money: (m: Money | null) => string;
}) {
  if (!data.estimate.found) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3 text-xs text-muted">
        <FileSpreadsheet className="h-3.5 w-3.5 text-faint" />
        This project has no Cost Estimate, so there is no baseline to budget from. Task budgets can
        still be entered by hand.
      </div>
    );
  }

  if (data.estimate.currencyMismatch) {
    return (
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-amber-50 px-5 py-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        The Cost Estimate ({data.estimate.version}) is priced in {data.estimate.currency}, but this
        rollup is in {data.currency}. Its figures are not converted or seeded — there is no exchange
        rate in this application.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-5 py-3 text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted">
        <FileSpreadsheet className="h-3.5 w-3.5 text-faint" />
        Cost Estimate {data.estimate.version}
      </span>
      {reconciliation ? (
        <>
          <Figure label="Grand total" value={money(reconciliation.grandTotal)} />
          <Figure label="Direct cost" value={money(reconciliation.direct)} />
          <Figure label="Placed on activities" value={money(reconciliation.allocated)} />
          <Figure
            label="Not yet placed"
            value={money(reconciliation.unallocated)}
            tone={reconciliation.unallocated.minor < 0 ? "text-red-600" : undefined}
          />
        </>
      ) : null}
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-muted">
      {label}
      <span className={cn("font-mono text-sm font-semibold tabular-nums text-fg", tone)}>{value}</span>
    </span>
  );
}

/* ── One activity ──────────────────────────────────────────────────────────── */

function TaskRow({
  row,
  depth,
  money,
  hasEstimate,
  pickerOpen,
  onOpenPicker,
  onChange,
}: {
  row: BudgetRow;
  depth: number;
  money: (m: Money | null) => string;
  hasEstimate: boolean;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onChange: BudgetChangeHandler;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shown = draft ?? (row.budget === null ? "" : String(toMajor(row.budget)));

  function commit() {
    if (draft === null) return;
    const parsed = parseBudgetInput(draft);
    if (!parsed.ok) {
      setError(parsed.reason);
      return;
    }
    setError(null);
    setDraft(null);
    // Typing over a seeded figure makes it the user's own number, so the provenance
    // and the estimate refs behind it are dropped rather than left claiming an origin
    // the amount no longer has.
    onChange(row.taskId, {
      amount: parsed.value,
      source: parsed.value === null ? null : "manual",
      ref: null,
    });
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-surface-2/60">
      <td className="px-3 py-1.5">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 14 }}>
          <span className="min-w-0 flex-1 truncate text-sm text-fg" title={row.name}>
            {row.name}
          </span>
          {row.budgetSource === "estimate" ? (
            <span
              className="shrink-0 rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand"
              title="Taken from the project's Cost Estimate"
            >
              Est
            </span>
          ) : null}
          {row.commitmentCount > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-faint">
              {row.commitmentCount} PO
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-1.5">
        <div className="flex items-center justify-end gap-1.5">
          <label className="sr-only" htmlFor={`budget-${row.taskId}`}>
            Budget for {row.name}
          </label>
          <input
            id={`budget-${row.taskId}`}
            inputMode="decimal"
            value={shown}
            placeholder="—"
            aria-invalid={error !== null}
            aria-describedby={error ? `budget-err-${row.taskId}` : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setDraft(null);
                setError(null);
              }
            }}
            className={cn(
              "w-28 rounded-md border bg-surface px-2 py-1 text-right font-mono text-sm tabular-nums text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
              error ? "border-red-500" : "border-border",
            )}
          />
          {hasEstimate ? (
            <button
              type="button"
              onClick={onOpenPicker}
              aria-expanded={pickerOpen}
              title="Take this budget from the Cost Estimate"
              className={cn(
                "shrink-0 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
                pickerOpen
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-surface text-muted hover:text-fg",
              )}
            >
              Est…
            </button>
          ) : null}
        </div>
        {error ? (
          <div id={`budget-err-${row.taskId}`} className="mt-0.5 text-right text-[10px] text-red-600">
            {error}
          </div>
        ) : null}
      </td>
      <td className={numberCell}>{money(row.committed)}</td>
      <td className={numberCell}>{money(row.received)}</td>
      <td className={cn(numberCell, row.budget === null ? "text-faint" : varianceTone(row.variance))}>
        {row.budget === null ? "—" : money(row.variance)}
      </td>
    </tr>
  );
}

function varianceTone(v: Money): string {
  return v.minor < 0 ? "text-red-600" : v.minor > 0 ? "text-emerald-600" : "text-fg";
}

/* ── Estimate line picker ──────────────────────────────────────────────────── */

/**
 * HOW ESTIMATE MONEY GETS ONTO A TASK — and why it is a picker rather than a mapping.
 *
 * Estimate lines and schedule activities are different shapes with no key between them:
 * an estimate is priced by trade section and take-off item, a programme is sequenced by
 * activity, and one activity routinely spans several estimate lines while one estimate
 * line routinely spans several activities. Matching them automatically — by name, by
 * discipline, by proportion of duration — would produce a number that looks authoritative
 * and is actually a guess, and a wrong budget is worse than a blank one because nobody
 * re-checks a figure the software supplied.
 *
 * So the mapping is made by the person who knows it. What the software contributes is
 * exactness and arithmetic: the chosen lines are summed at the estimate's own amounts
 * (never re-derived here), the refs are recorded so the figure can be audited back to
 * source, and the header reports how much estimate money is still unplaced.
 */
function EstimatePicker({
  lines,
  currency,
  task,
  onApply,
  onClose,
}: {
  lines: ScheduleBudgetData["estimate"]["lines"];
  currency: string;
  task: BudgetPanelTask | null;
  onApply: (amount: number, ref: string) => void;
  onClose: () => void;
}) {
  const initial = useMemo(
    () => new Set((task?.budgetRef ?? "").split(",").filter(Boolean)),
    [task?.budgetRef],
  );
  const [picked, setPicked] = useState<Set<string>>(initial);

  const refs = useMemo(() => [...picked], [picked]);
  const total = useMemo(() => sumEstimateLines(lines, refs, currency), [lines, refs, currency]);

  function toggle(ref: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  }

  return (
    <div className="border-y border-border bg-surface-2 px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Coins className="h-3.5 w-3.5 text-brand" />
        <span className="text-xs font-semibold text-fg">
          Estimate lines for “{task?.name ?? "activity"}”
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded p-1 text-faint transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-label="Close estimate picker"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-2 text-[11px] text-muted">
        Choose the estimate lines this activity is funded by. The budget becomes their exact sum —
        selecting a section already covers its items, so those are not counted twice.
      </p>
      <div
        role="group"
        aria-label="Estimate lines"
        className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface"
      >
        {lines.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">This estimate has no priced lines.</p>
        ) : (
          lines.map((l) => {
            const on = picked.has(l.ref);
            const coveredByParent = l.parentRef !== null && picked.has(l.parentRef);
            return (
              <label
                key={l.ref}
                className={cn(
                  "flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0 hover:bg-surface-2",
                  l.kind === "item" && "pl-8",
                  coveredByParent && "opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(l.ref)}
                  className="h-3.5 w-3.5 shrink-0 accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-xs",
                    l.kind === "category" ? "font-semibold text-fg" : "text-muted",
                  )}
                >
                  {l.label}
                  {coveredByParent ? (
                    <span className="ml-1.5 text-[10px] text-faint">(in section)</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-fg">
                  {formatCurrency(l.amount, currency, { maximumFractionDigits: 2 })}
                </span>
              </label>
            );
          })
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted">
          Selected{" "}
          <span className="font-mono text-sm font-semibold tabular-nums text-fg">
            {formatCurrency(toMajor(total), currency, { maximumFractionDigits: 2 })}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onApply(toMajor(total), refs.join(","))}
          disabled={refs.length === 0}
          className="ml-auto rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-default disabled:opacity-50"
        >
          Set budget
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Money that is not on a task ───────────────────────────────────────────── */

/**
 * A budget screen that quietly loses money is worse than one that says where the money
 * went, so every commitment that cannot be attributed is named here with its value and
 * a control to attribute it. Nothing is spread across activities by a guess.
 */
function Buckets({
  rollup,
  tasks,
  money,
  pending,
  error,
  onAssign,
}: {
  rollup: BudgetRollup;
  tasks: BudgetPanelTask[];
  money: (m: Money | null) => string;
  pending: boolean;
  error: string | null;
  onAssign: (purchaseOrderId: string, taskKey: string | null) => void;
}) {
  const { unassigned, orphaned, excluded, doubleCountedParents } = rollup;
  const nothing =
    unassigned.count === 0 &&
    orphaned.count === 0 &&
    excluded.count === 0 &&
    doubleCountedParents.length === 0;
  if (nothing) return null;

  return (
    <div className="space-y-3 border-t border-border bg-surface-2 px-5 py-4">
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      ) : null}

      {unassigned.count > 0 ? (
        <section aria-label="Unassigned commitments">
          <h3 className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            {unassigned.count} purchase{" "}
            {unassigned.count === 1 ? "order is" : "orders are"} not assigned to an activity
            <span className="font-mono tabular-nums text-muted">
              {money(unassigned.committed)} committed · {money(unassigned.received)} received
            </span>
          </h3>
          <p className="mb-2 text-[11px] text-muted">
            This money is real and is excluded from every figure in the table above. Assign each
            order to the activity it belongs to.
          </p>
          <ul className="space-y-1">
            {unassigned.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-fg">{o.reference}</span>
                <span className="truncate text-muted">{o.vendorName}</span>
                <span className="rounded-full bg-surface px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-faint">
                  {o.status.toLowerCase()}
                </span>
                <label className="sr-only" htmlFor={`assign-${o.id}`}>
                  Assign {o.reference} to an activity
                </label>
                <select
                  id={`assign-${o.id}`}
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => onAssign(o.id, e.target.value || null)}
                  className="ml-auto max-w-[240px] rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
                >
                  <option value="">Assign to activity…</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {"— ".repeat(t.depth)}
                      {t.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {orphaned.count > 0 ? (
        <section aria-label="Orphaned commitments">
          <h3 className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
            {orphaned.count} purchase {orphaned.count === 1 ? "order points" : "orders point"} at an
            activity that no longer exists
            <span className="font-mono tabular-nums text-muted">
              {money(orphaned.committed)} committed
            </span>
          </h3>
          <ul className="space-y-1">
            {orphaned.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono text-fg">{o.reference}</span>
                <span className="truncate text-muted">{o.vendorName}</span>
                <label className="sr-only" htmlFor={`reassign-${o.id}`}>
                  Reassign {o.reference}
                </label>
                <select
                  id={`reassign-${o.id}`}
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => onAssign(o.id, e.target.value || null)}
                  className="ml-auto max-w-[240px] rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
                >
                  <option value="">Reassign to an activity…</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {"— ".repeat(t.depth)}
                      {t.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {excluded.count > 0 ? (
        <section aria-label="Excluded commitments">
          <h3 className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            {excluded.count} purchase {excluded.count === 1 ? "order is" : "orders are"} in another
            currency ({excluded.currencies.join(", ")})
          </h3>
          <p className="text-[11px] text-muted">
            Not converted and not included in any total — this application holds no exchange rate,
            and inventing one would fabricate money.{" "}
            {excluded.orders.map((o) => o.reference).join(", ")}
          </p>
        </section>
      ) : null}

      {doubleCountedParents.length > 0 ? (
        <section aria-label="Double-counted parents">
          <h3 className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Budget may be counted twice
          </h3>
          <p className="text-[11px] text-muted">
            {doubleCountedParents.join(", ")} {doubleCountedParents.length === 1 ? "carries" : "carry"}{" "}
            a budget and also {doubleCountedParents.length === 1 ? "has" : "have"} budgeted sub-tasks.
            Each figure is counted once in the total, so the parent&rsquo;s own amount is added on top
            of its children&rsquo;s rather than replaced by them.
          </p>
        </section>
      ) : null}
    </div>
  );
}
