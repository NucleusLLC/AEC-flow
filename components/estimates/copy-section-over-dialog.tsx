"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2, Search, Import, X, AlertTriangle } from "lucide-react";
import {
  listSectionSourcesAction,
  loadSectionSourceAction,
} from "@/app/(app)/estimates/section-source-actions";
import { copyLines, copySummary, currenciesMatch, type Selection } from "@/lib/estimates/copy-lines";
import { filterSources, type SectionSource } from "@/lib/estimates/section-sources";
import { categoryTotals } from "@/lib/estimates/calc";
import type { CostEstimate, EstimateCategory } from "@/lib/data/estimates.types";
import { militaryDate } from "@/lib/building-permits/register";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

/**
 * "Copy Section over" — pull sections from another Job Order's cost estimate into
 * the one being edited. Two steps: pick the Job Order, then tick its sections (or
 * single lines inside them). See `lib/estimates/section-sources.ts` for why this
 * sits beside `SectionCopy` and `CopyTasksDialog`, and why the copy lands in the
 * editor's state rather than being written on the server.
 *
 * Military presentation, as asked: dates read `15 SEP 2026`, labels are capitals,
 * Job Order numbers lead every row.
 */

const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");

export function CopySectionOverDialog({
  targetEstimateId,
  targetCurrency,
  newId,
  onClose,
  onCopy,
}: {
  targetEstimateId: string;
  targetCurrency: string;
  /** The editor's own id factory, so copied rows look like rows made on the sheet. */
  newId: (prefix: string) => string;
  onClose: () => void;
  /** Append these sections to the open estimate. */
  onCopy: (categories: EstimateCategory[]) => void;
}) {
  const t = useT();
  const [sources, setSources] = useState<SectionSource[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<SectionSource | null>(null);
  const [sheet, setSheet] = useState<CostEstimate | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [wholeSections, setWholeSections] = useState<Set<string>>(new Set());
  const [singleItems, setSingleItems] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [includeQuantities, setIncludeQuantities] = useState(false);
  const [includePrices, setIncludePrices] = useState(true);
  const [done, setDone] = useState<{ sections: number; tasks: number } | null>(null);

  useEffect(() => {
    let live = true;
    void listSectionSourcesAction(targetEstimateId).then((res) => {
      if (!live) return;
      if (res.ok) setSources(res.sources);
      else {
        setSources([]);
        setListError(res.error);
      }
    });
    return () => {
      live = false;
    };
  }, [targetEstimateId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visible = useMemo(() => filterSources(sources ?? [], query), [sources, query]);

  const pick = async (src: SectionSource) => {
    setPicked(src);
    setSheet(null);
    setSheetError(null);
    setWholeSections(new Set());
    setSingleItems(new Set());
    setExpanded(new Set());
    setIncludePrices(currenciesMatch(src.currency, targetCurrency));
    setLoadingSheet(true);
    const res = await loadSectionSourceAction(src.id).catch(() => ({ ok: false as const, error: "That estimate could not be loaded." }));
    setLoadingSheet(false);
    if (res.ok) setSheet(res.estimate);
    else setSheetError(res.error);
  };

  const back = () => {
    setPicked(null);
    setSheet(null);
    setSheetError(null);
  };

  const sourceCurrency = sheet?.currency ?? picked?.currency ?? targetCurrency;
  const sameCurrency = currenciesMatch(sourceCurrency, targetCurrency);
  const categories = useMemo(() => sheet?.categories ?? [], [sheet]);
  const selection: Selection = useMemo(
    () => ({ sections: [...wholeSections], items: [...singleItems] }),
    [wholeSections, singleItems],
  );

  /** The same pure function that will make the copy, so the sentence is the outcome. */
  const preview = useMemo(() => {
    const options = {
      includeQuantities,
      includePrices: includePrices && sameCurrency,
      sourceCurrency,
      targetCurrency,
    };
    let n = 0;
    const result = copyLines(categories, selection, options, () => `preview-${++n}`);
    return { result, text: copySummary(result, options) };
  }, [categories, selection, includeQuantities, includePrices, sameCurrency, sourceCurrency, targetCurrency]);

  const sectionState = (c: EstimateCategory): "all" | "some" | "none" => {
    if (wholeSections.has(c.id)) return "all";
    const n = c.items.filter((it) => singleItems.has(it.id)).length;
    if (n === 0) return "none";
    return n === c.items.length ? "all" : "some";
  };

  const toggleSection = (c: EstimateCategory) => {
    const on = sectionState(c) !== "all";
    setWholeSections((s) => {
      const next = new Set(s);
      if (on) next.add(c.id);
      else next.delete(c.id);
      return next;
    });
    // The section now speaks for its lines either way; drop their single ticks.
    setSingleItems((s) => {
      const next = new Set(s);
      c.items.forEach((it) => next.delete(it.id));
      return next;
    });
  };

  const toggleItem = (c: EstimateCategory, itemId: string) => {
    if (wholeSections.has(c.id)) {
      // Unticking one line of a whole section: the rest stay ticked, one by one.
      setWholeSections((s) => {
        const next = new Set(s);
        next.delete(c.id);
        return next;
      });
      setSingleItems((s) => {
        const next = new Set(s);
        c.items.forEach((it) => {
          if (it.id !== itemId) next.add(it.id);
        });
        return next;
      });
      return;
    }
    setSingleItems((s) => {
      const next = new Set(s);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const allCopyable = categories.filter((c) => c.items.length > 0);
  const allTicked = allCopyable.length > 0 && allCopyable.every((c) => sectionState(c) === "all");
  const toggleAll = () => {
    setSingleItems(new Set());
    setWholeSections(allTicked ? new Set() : new Set(allCopyable.map((c) => c.id)));
  };

  const run = () => {
    if (preview.result.taskCount === 0) return;
    const options = {
      includeQuantities,
      includePrices: includePrices && sameCurrency,
      sourceCurrency,
      targetCurrency,
    };
    const result = copyLines(categories, selection, options, (kind) => newId(kind === "section" ? "c" : "i"));
    onCopy(result.categories);
    setDone({ sections: result.categories.length, tasks: result.taskCount });
  };

  const jobLabel = (s: { projectNumber: string; projectName: string }) =>
    s.projectNumber.trim() ? `${s.projectNumber} · ${s.projectName}` : s.projectName;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Copy Section over")}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-fg">
              <Import className="h-4 w-4 text-brand" /> {t("Copy Section over")}
            </div>
            <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-faint">
              {done
                ? t("Complete")
                : picked
                  ? t("Step 2 of 2 · Select sections")
                  : t("Step 1 of 2 · Select Job Order")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done && picked ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-6 w-6" />
            </span>
            <div className="text-sm font-semibold uppercase tracking-wide text-fg">
              {fmt(t("{sections} section(s) · {tasks} line(s) copied over"), { sections: done.sections, tasks: done.tasks })}
            </div>
            <div className="text-xs text-muted">
              {fmt(t("From {job}. They were added after the sections already on this estimate and save with it."), { job: jobLabel(picked) })}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setDone(null);
                  setWholeSections(new Set());
                  setSingleItems(new Set());
                }}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"
              >
                {t("Copy more from this Job Order")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90"
              >
                {t("Done")}
              </button>
            </div>
          </div>
        ) : !picked ? (
          /* ── STEP 1: JOB ORDERS ─────────────────────────────────────────── */
          <>
            <div className="border-b border-border px-4 py-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Search Job Order number, project or client")}
                  aria-label={t("Search Job Order number, project or client")}
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {sources === null ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading Job Orders…")}
                </div>
              ) : listError ? (
                <ErrorNote title={t("The Job Orders could not be loaded.")} detail={t(listError)} />
              ) : visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted">
                  {sources.length === 0
                    ? t("No other Job Order has an estimate with sections yet.")
                    : t("No Job Order matches that search.")}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-left font-mono text-[10px] uppercase tracking-wider text-faint">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t("Job Order")}</th>
                      <th className="px-2 py-2 font-medium">{t("Project")}</th>
                      <th className="hidden px-2 py-2 font-medium sm:table-cell">{t("Version")}</th>
                      <th className="hidden px-2 py-2 font-medium sm:table-cell">{t("Date")}</th>
                      <th className="px-4 py-2 text-right font-medium">{t("Sections")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => void pick(s)}
                        className="cursor-pointer border-t border-border hover:bg-brand/5"
                      >
                        <td className="whitespace-nowrap px-4 py-2 align-top font-mono text-xs font-semibold text-fg">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void pick(s);
                            }}
                            className="text-left hover:text-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand/40"
                          >
                            {s.projectNumber.trim() || "—"}
                          </button>
                        </td>
                        <td className="px-2 py-2 align-top">
                          <div className="font-medium text-fg">{s.projectName}</div>
                          <div className="text-[11px] text-faint">
                            {[s.client, currenciesMatch(s.currency, targetCurrency) ? "" : s.currency, s.locked ? t("LOCKED") : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </td>
                        <td className="hidden whitespace-nowrap px-2 py-2 align-top font-mono text-xs text-muted sm:table-cell">{s.version}</td>
                        <td className="hidden whitespace-nowrap px-2 py-2 align-top font-mono text-xs text-muted sm:table-cell">
                          {s.date ? militaryDate(s.date) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right align-top font-mono text-xs text-muted">
                          {s.sectionCount} / {s.lineCount}
                          <div className="text-[10px] text-faint">{t("sec / lines")}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
                {sources ? fmt(t("{count} Job Order estimate(s)"), { count: visible.length }) : ""}
              </span>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg"
              >
                {t("Cancel")}
              </button>
            </div>
          </>
        ) : (
          /* ── STEP 2: THAT JOB ORDER'S COST ESTIMATE ─────────────────────── */
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-fg">{picked.projectNumber.trim() || "—"}</div>
                <div className="truncate text-sm font-medium text-fg">{picked.projectName}</div>
                <div className="font-mono text-[11px] uppercase tracking-wider text-faint">
                  {[picked.version, picked.date ? militaryDate(picked.date) : "", sourceCurrency, picked.client].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button
                type="button"
                onClick={back}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:text-fg"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> {t("Other Job Order")}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {loadingSheet ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("Loading the cost estimate…")}
                </div>
              ) : sheetError ? (
                <ErrorNote title={t("That estimate could not be loaded.")} detail={t(sheetError)} />
              ) : sheet ? (
                <>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
                      {t("Cost estimate · tick the sections to copy")}
                    </span>
                    <button
                      type="button"
                      onClick={toggleAll}
                      disabled={allCopyable.length === 0}
                      className="text-xs font-medium text-brand hover:underline disabled:opacity-40"
                    >
                      {allTicked ? t("Clear all") : t("Select all")}
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {categories.map((c) => {
                      const state = sectionState(c);
                      const isOpen = expanded.has(c.id);
                      const empty = c.items.length === 0;
                      const total = categoryTotals(c, sheet.avgLaborRate).total;
                      return (
                        <li key={c.id} className="rounded-lg border border-border">
                          <div className="flex items-center gap-2 px-2 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((s) => {
                                  const next = new Set(s);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                })
                              }
                              disabled={empty}
                              aria-label={isOpen ? t("Hide lines") : t("Show lines")}
                              aria-expanded={isOpen}
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-faint hover:text-fg disabled:opacity-30"
                            >
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <label className={`flex min-w-0 flex-1 items-center gap-2 ${empty ? "opacity-50" : "cursor-pointer"}`}>
                              <input
                                type="checkbox"
                                checked={state === "all"}
                                ref={(el) => {
                                  if (el) el.indeterminate = state === "some";
                                }}
                                disabled={empty}
                                onChange={() => toggleSection(c)}
                                className="h-4 w-4 shrink-0 accent-brand"
                              />
                              {c.code ? <span className="shrink-0 font-mono text-xs text-faint">{c.code}</span> : null}
                              <span className="min-w-0 truncate text-sm font-medium text-fg">{c.name}</span>
                            </label>
                            <span className="shrink-0 text-right font-mono text-xs text-muted">
                              {empty ? t("empty") : `${sourceCurrency} ${nf0(total)}`}
                              <span className="block text-[10px] text-faint">
                                {fmt(t("{count} line(s)"), { count: c.items.length })}
                              </span>
                            </span>
                          </div>
                          {isOpen && !empty ? (
                            <ul className="border-t border-border bg-surface-2/40 py-1">
                              {c.items.map((it) => (
                                <li key={it.id}>
                                  <label className="flex cursor-pointer items-center gap-2 py-1 pl-10 pr-3 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={state === "all" || singleItems.has(it.id)}
                                      onChange={() => toggleItem(c, it.id)}
                                      className="h-3.5 w-3.5 shrink-0 accent-brand"
                                    />
                                    {it.code ? <span className="shrink-0 font-mono text-faint">{it.code}</span> : null}
                                    <span className="min-w-0 flex-1 truncate text-fg">{it.task || t("(untitled line)")}</span>
                                    <span className="shrink-0 font-mono text-faint">{it.unit}</span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : null}
            </div>

            {sheet ? (
              <div className="space-y-2 border-t border-border px-4 py-3">
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  <Toggle
                    checked={includeQuantities}
                    onChange={setIncludeQuantities}
                    label={t("Also copy the quantities")}
                  />
                  <Toggle
                    checked={includePrices && sameCurrency}
                    onChange={setIncludePrices}
                    disabled={!sameCurrency}
                    label={
                      sameCurrency
                        ? t("Also copy the unit prices")
                        : fmt(t("Unit prices stay behind ({source} into {target})"), { source: sourceCurrency, target: targetCurrency })
                    }
                  />
                </div>
                <div className="rounded-lg bg-surface-2/60 px-3 py-2 text-xs text-muted">
                  <span className="font-semibold uppercase tracking-wide text-fg">{t("Copying:")}</span> {preview.text}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!sheet || preview.result.taskCount === 0}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Import className="h-4 w-4" />
                {preview.result.categories.length === 1
                  ? t("Copy 1 section over")
                  : fmt(t("Copy {count} sections over"), { count: preview.result.categories.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorNote({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="m-4 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={`inline-flex items-center gap-2 text-xs ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-brand"
      />
      <span className="font-medium text-fg">{label}</span>
    </label>
  );
}
