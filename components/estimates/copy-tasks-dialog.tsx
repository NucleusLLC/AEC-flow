"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, X, Loader2, Check, AlertTriangle, ArrowRight } from "lucide-react";
import {
  copyTasksToProjectAction,
  listCopyDestinationsAction,
} from "@/app/(app)/estimates/actions";
import { copySummary, copyLines, currenciesMatch } from "@/lib/estimates/copy-lines";
import type { CopyDestination, EstimateCategory } from "@/lib/data/estimates.types";
import { militaryDate } from "@/lib/building-permits/register";

/**
 * "Copy to another / new project" — the destination picker for coded tasks
 * selected on the sheet.
 *
 * WHY THIS EXISTS BESIDE `SectionCopy`. That control is a localStorage
 * clipboard: one slot, one browser, no destination picker, and nothing reaches
 * the server. It answers "paste this where I am"; this answers "put this on that
 * project", which is the thing that was asked for and the thing that survives
 * closing the laptop.
 *
 * WHAT IT SHOWS BEFORE IT ACTS. The count, and what is being LEFT BEHIND —
 * quantities and prices reset to zero unless asked for. A dialog that said only
 * "3 tasks" would be technically complete and would still surprise the person
 * who expected their numbers to arrive with them. `copySummary` writes that
 * sentence and is unit-tested, so the screen and the copy cannot disagree.
 */

export function CopyTasksDialog({
  sourceEstimateId,
  sourceCurrency,
  categories,
  selection,
  onClose,
  onCopied,
}: {
  sourceEstimateId: string;
  sourceCurrency: string;
  categories: EstimateCategory[];
  selection: { sections: string[]; items: string[] };
  onClose: () => void;
  onCopied?: (result: { estimateId: string; taskCount: number }) => void;
}) {
  const [projects, setProjects] = useState<CopyDestination[] | null>(null);
  const [targetId, setTargetId] = useState<string>("");
  const [includeQuantities, setIncludeQuantities] = useState(false);
  const [includePrices, setIncludePrices] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    taskCount: number;
    sectionCount: number;
    created: boolean;
    pricesWithheld: boolean;
    estimateId: string;
  } | null>(null);

  const target = (projects ?? []).find((p) => p.id === targetId) ?? null;
  const targetCurrency = target?.currency ?? sourceCurrency;
  const sameCurrency = currenciesMatch(sourceCurrency, targetCurrency);

  useEffect(() => {
    let live = true;
    void listCopyDestinationsAction(sourceEstimateId).then((rows) => {
      if (live) setProjects(rows);
    });
    return () => {
      live = false;
    };
  }, [sourceEstimateId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  /**
   * The same pure function the server will run, so the sentence on screen is the
   * outcome rather than a description of it. Ids are irrelevant to the summary,
   * hence the throwaway factory.
   */
  const preview = useMemo(() => {
    const options = {
      includeQuantities,
      includePrices: includePrices && sameCurrency,
      sourceCurrency,
      targetCurrency,
    };
    let n = 0;
    const result = copyLines(categories, selection, options, () => `preview-${++n}`);
    return { text: copySummary(result, options), taskCount: result.taskCount };
  }, [categories, selection, includeQuantities, includePrices, sameCurrency, sourceCurrency, targetCurrency]);

  const run = async () => {
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await copyTasksToProjectAction({
      sourceEstimateId,
      targetProjectId: target.id,
      selection: { sections: [...selection.sections], items: [...selection.items] },
      options: { includeQuantities, includePrices: includePrices && sameCurrency },
    }).catch((e: unknown) => ({
      ok: false as const,
      error: e instanceof Error ? e.message : "The copy could not be completed.",
    }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone({
      taskCount: res.taskCount,
      sectionCount: res.sectionCount,
      created: res.created,
      pricesWithheld: res.pricesWithheld,
      estimateId: res.estimateId,
    });
    onCopied?.({ estimateId: res.estimateId, taskCount: res.taskCount });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-fg">
            <Copy className="h-4 w-4 text-brand" /> Copy tasks to another project
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:text-fg disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-6 w-6" />
            </span>
            <div className="text-sm font-semibold text-fg">
              {done.taskCount} {done.taskCount === 1 ? "task" : "tasks"} copied to{" "}
              {target?.name ?? "the project"}
            </div>
            <div className="text-xs text-muted">
              {done.created
                ? "That project had no estimate, so one was created for it."
                : "They were added after the sections already on that sheet."}
              {done.pricesWithheld
                ? " Prices were not copied, because the two estimates use different currencies."
                : ""}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                Close
              </button>
              <a
                href={`/estimates?project=${done.estimateId}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90"
              >
                Open that estimate <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 px-4 py-4">
              {error ? (
                <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Nothing was copied.</div>
                    <div className="mt-0.5">{error}</div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
                <span className="font-medium text-fg">Copying:</span> {preview.text}
              </div>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-faint">
                  Destination project
                </span>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30"
                >
                  <option value="">Choose a project…</option>
                  {(projects ?? []).map((p) => (
                    <option key={p.id} value={p.id} disabled={p.locked}>
                      {p.projectNumber} · {p.name}
                      {p.hasEstimate
                        ? ` — estimate ${p.estimateDate ? militaryDate(p.estimateDate) : "undated"}${p.locked ? " (LOCKED)" : ""}`
                        : " — no estimate yet"}
                      {currenciesMatch(p.currency, sourceCurrency) ? "" : ` · ${p.currency}`}
                    </option>
                  ))}
                </select>
                {projects === null ? (
                  <span className="mt-1 block text-xs text-faint">Loading projects…</span>
                ) : projects.length === 0 ? (
                  <span className="mt-1 block text-xs text-muted">
                    There is no other project to copy into yet.
                  </span>
                ) : null}
              </label>

              {target && !target.hasEstimate ? (
                <div className="rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
                  {target.name} has no estimate yet, so one will be created — with its
                  own client and project details, and with this estimate&apos;s labour
                  rate and margins, so the copied labour norms price to something.
                  The built-up area does not travel: that describes a building.
                </div>
              ) : null}

              <div className="space-y-2 rounded-lg border border-border px-3 py-2">
                <Toggle
                  checked={includeQuantities}
                  onChange={setIncludeQuantities}
                  disabled={busy}
                  label="Also copy the quantities"
                  hint="Off by default: a quantity comes from THIS project's take-off, so it describes this building."
                />
                <Toggle
                  checked={includePrices && sameCurrency}
                  onChange={setIncludePrices}
                  disabled={busy || !sameCurrency}
                  label="Also copy the unit prices"
                  hint={
                    sameCurrency
                      ? "Prices are snapshots taken when each line was added — region, indexation and FX included."
                      : `Not available: this estimate is in ${sourceCurrency} and the destination is in ${targetCurrency}, so the stored prices do not mean the same thing.`
                  }
                />
                <p className="text-[11px] leading-snug text-faint">
                  Labour norms (hours per unit) always travel — the destination applies its
                  own labour rate. Progress is always reset to zero.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                disabled={busy || !target || preview.taskCount === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                {busy ? "Copying…" : "Copy tasks"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint: string;
}) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand"
      />
      <span className="min-w-0">
        <span className="text-xs font-medium text-fg">{label}</span>
        <span className="block text-[11px] leading-snug text-faint">{hint}</span>
      </span>
    </label>
  );
}
