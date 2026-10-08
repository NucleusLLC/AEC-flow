"use client";

/**
 * PHASES on a project: the list, the editor, and the hours booked to each one.
 *
 * Lives on the project's Timeframe tab, under the bar chart. EDIT PHASES opens
 * the whole list for editing — rename, reorder, remove, dates, status, percent,
 * discipline — and SAVE PHASES sends it back in its new order. A project with
 * no phases gets one button, LOAD STANDARD PHASES, which saves the seven
 * standard ones straight away.
 *
 * WRITE-THEN-SHOW: what is drawn after a save is the screen the action returns
 * (re-read from the database), not local state and not `router.refresh()` —
 * see permitSnapshotAction. The refresh still runs, for the bar chart above.
 *
 * Project progress is derived by the server (lib/projects/phases.ts,
 * equal-weighted average) and shown here as it comes back.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, RefreshCw, Save, X, AlertTriangle } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { formatCurrency } from "@/lib/format";
import { militaryDate } from "@/lib/building-permits/register";
import { DISCIPLINE_LABEL } from "@/lib/data/projects.types";
import {
  missingPresets,
  movePhase,
  PHASE_DISCIPLINES,
  PHASE_STATUSES,
  PHASE_STATUS_OPTION,
  standardPhaseDrafts,
  type PhaseDiscipline,
  type PhaseDraft,
  type PhaseStatusValue,
} from "@/lib/projects/phases";
import type { PhaseScreen } from "@/lib/data/project-phases";
import { phaseScreenAction, savePhasesAction } from "@/app/(app)/projects/[id]/timeframe/actions";

const OLIVE_BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#4b5320] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] shadow-sm hover:bg-[#3f4a1c] disabled:cursor-not-allowed disabled:opacity-50";
const OLIVE_GHOST =
  "inline-flex h-8 items-center gap-1 rounded-md border border-[#5c6633]/60 bg-[#e4e8dc] px-2.5 text-xs font-semibold uppercase tracking-wide text-[#4b5320] hover:bg-[#c5d18a] disabled:opacity-50";
const FIELD =
  "h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-fg outline-none focus:border-[#5c6633] focus:ring-2 focus:ring-[#8a9a5b]/30";
const TH = "px-2 pb-1.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-faint";

type EditRow = {
  key: string;
  id: string | null;
  name: string;
  discipline: PhaseDiscipline | "";
  status: PhaseStatusValue;
  progressPct: string;
  startDate: string;
  endDate: string;
};

let seq = 0;
const newKey = () => `n${++seq}`;

function toEdit(screen: PhaseScreen): EditRow[] {
  return screen.phases.map((p) => ({
    key: p.id,
    id: p.id,
    name: p.name,
    discipline: p.discipline ?? "",
    status: p.status,
    progressPct: String(p.progressPct),
    startDate: p.startDate ?? "",
    endDate: p.endDate ?? "",
  }));
}

function toDrafts(rows: EditRow[]): PhaseDraft[] {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    discipline: r.discipline || null,
    status: r.status,
    progressPct: r.progressPct,
    startDate: r.startDate || null,
    endDate: r.endDate || null,
  }));
}

const STATUS_TONE: Record<PhaseStatusValue, string> = {
  NOT_STARTED: "border-border bg-surface-2 text-muted",
  IN_PROGRESS: "border-[#5c6633] bg-[#e4e8dc] text-[#4b5320]",
  ON_HOLD: "border-amber-400 bg-amber-50 text-amber-800",
  COMPLETED: "border-emerald-500 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-slate-300 bg-slate-50 text-slate-500",
};

export function PhaseEditor({ initial }: { initial: PhaseScreen }) {
  const t = useT();
  const router = useRouter();
  const [screen, setScreen] = useState<PhaseScreen>(initial);
  const [rows, setRows] = useState<EditRow[] | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editing = rows !== null;
  const hoursByPhase = useMemo(() => new Map(screen.hours.rows.map((r) => [r.phaseId ?? "", r])), [screen]);
  const money = (n: number) =>
    formatCurrency(n, screen.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function save(drafts: PhaseDraft[]) {
    setError(null);
    startTransition(async () => {
      const res = await savePhasesAction(screen.projectId, drafts);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setScreen(res.screen);
      setRows(null);
      setCustom("");
      router.refresh();
    });
  }

  function reload() {
    setError(null);
    startTransition(async () => {
      const res = await phaseScreenAction(screen.projectId);
      if (res.ok) setScreen(res.screen);
      else setError(res.error);
    });
  }

  function patch(key: string, change: Partial<EditRow>) {
    setRows((rs) =>
      (rs ?? []).map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...change };
        // A completed phase is 100% — the server enforces it; show it now.
        if (change.status === "COMPLETED") next.progressPct = "100";
        return next;
      }),
    );
  }

  function addPhase(name: string) {
    const n = name.trim();
    if (!n) return;
    setRows((rs) => [
      ...(rs ?? []),
      { key: newKey(), id: null, name: n, discipline: "", status: "NOT_STARTED", progressPct: "0", startDate: "", endDate: "" },
    ]);
  }

  const presets = missingPresets((rows ?? []).map((r) => r.name));

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-xl border border-[#5c6633] bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#4b5320] px-4 py-3 text-[#e4e8dc]">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest">{t("PHASES")}</div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#c5d18a]">
              {fmt(t("PROJECT PROGRESS {pct}% · AVERAGE OF THE PHASES"), { pct: screen.progressPct })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!editing ? (
              <>
                <button
                  type="button"
                  onClick={reload}
                  disabled={pending}
                  aria-label={t("Reload")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#c5d18a] hover:text-white disabled:opacity-40"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                {screen.phases.length === 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save(standardPhaseDrafts())}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c5d18a] bg-[#5c6633] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] hover:bg-[#3f4a1c] disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {t("LOAD STANDARD PHASES")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setRows(toEdit(screen));
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c5d18a] bg-[#5c6633] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] hover:bg-[#3f4a1c] disabled:opacity-50"
                >
                  <Pencil className="h-4 w-4" />
                  {screen.phases.length === 0 ? t("+ ADD PHASE") : t("EDIT PHASES")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setRows(null);
                    setError(null);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c5d18a]/60 px-3 text-sm font-semibold uppercase tracking-wide text-[#c5d18a] hover:text-white disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  {t("CANCEL")}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => save(toDrafts(rows))}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#c5d18a] bg-[#e4e8dc] px-3 text-sm font-semibold uppercase tracking-wide text-[#4b5320] hover:bg-white disabled:opacity-50"
                >
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {t("SAVE PHASES")}
                </button>
              </>
            )}
          </div>
        </div>

        {error ? (
          <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">{t("NOT SAVED.")}</div>
              <div className="mt-0.5">{error}</div>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto px-4 py-3">
          {!editing ? (
            screen.phases.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                {t("No phases defined for this project yet.")}{" "}
                {t("LOAD STANDARD PHASES adds Concept Design through Handover in one click.")}
              </p>
            ) : (
              <table className="w-full min-w-[760px] text-sm" data-testid="phase-table">
                <thead>
                  <tr>
                    <th className={TH}>#</th>
                    <th className={TH}>{t("PHASE")}</th>
                    <th className={TH}>{t("DISCIPLINE")}</th>
                    <th className={TH}>{t("START")}</th>
                    <th className={TH}>{t("END")}</th>
                    <th className={TH}>{t("STATUS")}</th>
                    <th className={`${TH} text-right`}>%</th>
                    <th className={`${TH} text-right`}>{t("HOURS")}</th>
                  </tr>
                </thead>
                <tbody>
                  {screen.phases.map((p, i) => {
                    const h = hoursByPhase.get(p.id);
                    return (
                      <tr key={p.id} className="border-t border-border/60" data-phase={p.name}>
                        <td className="px-2 py-2 font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")}</td>
                        <td className="px-2 py-2 font-semibold uppercase tracking-wide text-fg">{p.name}</td>
                        <td className="px-2 py-2 text-xs uppercase text-muted">
                          {p.discipline ? t(DISCIPLINE_LABEL[p.discipline]) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">{militaryDate(p.startDate)}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">{militaryDate(p.endDate)}</td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONE[p.status]}`}>
                            {t(PHASE_STATUS_OPTION[p.status])}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded bg-surface-2">
                              <div className="h-full bg-[#5c6633]" style={{ width: `${p.progressPct}%` }} />
                            </div>
                            <span className="w-9 font-mono text-xs tabular-nums text-fg">{p.progressPct}%</span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-fg">
                          {h ? h.hours.toFixed(2) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            <div className="space-y-3">
              <table className="w-full min-w-[960px] text-sm" data-testid="phase-edit-table">
                <thead>
                  <tr>
                    <th className={TH} />
                    <th className={TH}>{t("PHASE")}</th>
                    <th className={TH}>{t("DISCIPLINE")}</th>
                    <th className={TH}>{t("START")}</th>
                    <th className={TH}>{t("END")}</th>
                    <th className={TH}>{t("STATUS")}</th>
                    <th className={TH}>%</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className="border-t border-border/60 align-middle" data-edit-phase={r.name}>
                      <td className="whitespace-nowrap px-1 py-1.5">
                        <button
                          type="button"
                          onClick={() => setRows((rs) => movePhase(rs ?? [], i, -1))}
                          disabled={i === 0}
                          aria-label={fmt(t("Move {name} up"), { name: r.name })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRows((rs) => movePhase(rs ?? [], i, 1))}
                          disabled={i === rows.length - 1}
                          aria-label={fmt(t("Move {name} down"), { name: r.name })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="min-w-[220px] px-1 py-1.5">
                        <input
                          value={r.name}
                          onChange={(e) => patch(r.key, { name: e.target.value })}
                          aria-label={t("Phase name")}
                          maxLength={120}
                          className={`${FIELD} font-semibold uppercase`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          value={r.discipline}
                          onChange={(e) => patch(r.key, { discipline: e.target.value as PhaseDiscipline | "" })}
                          aria-label={t("Discipline")}
                          className={FIELD}
                        >
                          <option value="">—</option>
                          {PHASE_DISCIPLINES.map((d) => (
                            <option key={d} value={d}>
                              {t(DISCIPLINE_LABEL[d])}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="date"
                          value={r.startDate}
                          onChange={(e) => patch(r.key, { startDate: e.target.value })}
                          aria-label={t("Start date")}
                          className={`${FIELD} font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          type="date"
                          value={r.endDate}
                          min={r.startDate || undefined}
                          onChange={(e) => patch(r.key, { endDate: e.target.value })}
                          aria-label={t("End date")}
                          className={`${FIELD} font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          value={r.status}
                          onChange={(e) => patch(r.key, { status: e.target.value as PhaseStatusValue })}
                          aria-label={t("Status")}
                          className={FIELD}
                        >
                          {PHASE_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {t(PHASE_STATUS_OPTION[s])}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="w-20 px-1 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={r.progressPct}
                          onChange={(e) => patch(r.key, { progressPct: e.target.value })}
                          aria-label={t("Percent complete")}
                          className={`${FIELD} text-right font-mono`}
                        />
                      </td>
                      <td className="px-1 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRows((rs) => (rs ?? []).filter((x) => x.key !== r.key))}
                          aria-label={fmt(t("Remove {name}"), { name: r.name })}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-faint hover:bg-rose-50 hover:text-rose-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-faint">{t("QUICK ADD")}</span>
                {presets.map((p) => (
                  <button key={p} type="button" onClick={() => addPhase(p)} className={OLIVE_GHOST}>
                    <Plus className="h-3.5 w-3.5" />
                    {p}
                  </button>
                ))}
              </div>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addPhase(custom);
                  setCustom("");
                }}
              >
                <input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder={t("Custom phase name, e.g. AS-BUILT SURVEY")}
                  aria-label={t("Custom phase name")}
                  maxLength={120}
                  className={`${FIELD} max-w-sm uppercase placeholder:normal-case placeholder:text-faint`}
                />
                <button type="submit" disabled={!custom.trim()} className={OLIVE_BTN}>
                  <Plus className="h-4 w-4" />
                  {t("+ ADD PHASE")}
                </button>
              </form>
              <p className="text-[11px] leading-snug text-faint">
                {t("Project progress is the plain average of the phases’ percent complete — every phase counts the same, cancelled phases are left out. A phase with hours booked to it cannot be removed.")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-bold uppercase tracking-widest text-fg">{t("HOURS BY PHASE")}</div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-faint">
              {t("FROM THE TIMESHEET · REJECTED HOURS LEFT OUT")}
            </div>
          </div>
          <div className="font-mono text-xs tabular-nums text-muted">
            {fmt(t("{hours} h in total"), { hours: screen.hours.total.hours.toFixed(2) })}
          </div>
        </div>
        <div className="overflow-x-auto px-4 py-3">
          {screen.hours.rows.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {t("No hours booked to this project yet. Log them on Finance → Time and pick the phase.")}
            </p>
          ) : (
            <table className="w-full min-w-[640px] text-sm" data-testid="phase-hours">
              <thead>
                <tr>
                  <th className={TH}>{t("PHASE")} / {t("PERSON")}</th>
                  <th className={`${TH} text-right`}>{t("APPROVED")}</th>
                  <th className={`${TH} text-right`}>{t("DRAFT / SUBMITTED")}</th>
                  <th className={`${TH} text-right`}>{t("TOTAL")}</th>
                  {screen.showMoney ? (
                    <>
                      <th className={`${TH} text-right`}>{t("COST")}</th>
                      <th className={`${TH} text-right`}>{t("CHARGE VALUE")}</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {screen.hours.rows.map((row) => {
                  const name = row.phaseId
                    ? screen.phases.find((p) => p.id === row.phaseId)?.name ?? "—"
                    : t("No phase");
                  return [
                    <tr key={row.phaseId ?? "none"} className="border-t border-border bg-surface-2/50">
                      <td className="px-2 py-1.5 font-semibold uppercase tracking-wide text-fg">{name}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-fg">{row.approved.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right font-mono tabular-nums text-fg">{row.pending.toFixed(2)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold tabular-nums text-fg">{row.hours.toFixed(2)}</td>
                      {screen.showMoney ? (
                        <>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted">{money(row.cost)}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-muted">{money(row.value)}</td>
                        </>
                      ) : null}
                    </tr>,
                    ...row.people.map((p) => (
                      <tr key={`${row.phaseId ?? "none"}:${p.userId}`} className="border-t border-border/40" data-person={p.userName}>
                        <td className="py-1 pl-6 pr-2 text-muted">{p.userName}</td>
                        <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted">{p.approved.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-muted">{p.pending.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-fg">{p.hours.toFixed(2)}</td>
                        {screen.showMoney ? (
                          <>
                            <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-faint">{money(p.cost)}</td>
                            <td className="px-2 py-1 text-right font-mono text-xs tabular-nums text-faint">{money(p.value)}</td>
                          </>
                        ) : null}
                      </tr>
                    )),
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
