"use client";

import { useState } from "react";
import { Clock, Landmark, Users, Plus, Trash2, CalendarClock, Coins, SlidersHorizontal, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CostEstimate } from "@/lib/data/estimates";
import { sumGeneralConditions, type GeneralConditionItem } from "@/lib/data/general-conditions";
import {
  computeSchedule,
  computeDevelopmentCost,
  computeGrandCost,
  type Phase,
  type ScheduleConfig,
  type PaymentConfig,
} from "@/lib/estimates/budget-timeline";

const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");
const nf1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });

export function BudgetTimelineView({
  est,
  schedule,
  setSchedule,
  payment,
  setPayment,
  generalConditions = [],
  gcActive = false,
}: {
  est: CostEstimate;
  schedule: ScheduleConfig;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleConfig>>;
  payment: PaymentConfig;
  setPayment: React.Dispatch<React.SetStateAction<PaymentConfig>>;
  generalConditions?: GeneralConditionItem[];
  gcActive?: boolean;
}) {
  const money = (n: number) => `${est.currency} ${nf0(n)}`;

  // Total Development Cost — the contract price the disbursement draws against:
  // direct cost + General Conditions (when active), marked up by Risk & Profit + BBO.
  // Mirrors the estimate summary's Grand Total, so draws sum to what the client pays.
  const gcAmount = gcActive ? sumGeneralConditions(generalConditions) : 0;
  const developmentCost = computeDevelopmentCost(est, gcAmount);
  const directCost = computeGrandCost(est);

  // ---- Time-Schedule coupler (controlled config — shared with the print doc) ----
  const { hoursPerDay, crew, startDate, workingDaysPerWeek, overlapPct, contingencyDays } = schedule;
  const setHoursPerDay = (v: number) => setSchedule((s) => ({ ...s, hoursPerDay: v }));
  const setCrewFor = (id: string, v: number) =>
    setSchedule((s) => ({ ...s, crew: { ...s.crew, [id]: Math.max(1, v) } }));
  const setStartDate = (v: string) => setSchedule((s) => ({ ...s, startDate: v }));
  const setWorkingDaysPerWeek = (v: number) => setSchedule((s) => ({ ...s, workingDaysPerWeek: v }));
  const setOverlapPct = (v: number) => setSchedule((s) => ({ ...s, overlapPct: v }));
  const setContingencyDays = (v: number) => setSchedule((s) => ({ ...s, contingencyDays: v }));
  // Customize gate: Automatic (read-only defaults) vs Manual (editable).
  const [schedManual, setSchedManual] = useState(false);

  const { sched, grandCost, totalHours, totalDays, weeks, endDate } = computeSchedule(est, schedule, gcAmount);

  // ---- PayApp (controlled config — shared with the print doc) ----
  const { retention, phases } = payment;
  const retEnabled = !!payment.retentionEnabled;
  // The Customize button puts the configurator (and retainage) into Manual mode.
  const payManual = (payment.retentionMode ?? "auto") === "manual";
  const setRetention = (v: number) => setPayment((p) => ({ ...p, retention: v }));
  const setRetEnabled = (on: boolean) => setPayment((p) => ({ ...p, retentionEnabled: on }));
  const setPayManual = (manual: boolean) => setPayment((p) => ({ ...p, retentionMode: manual ? "manual" : "auto" }));
  const patchPhase = (id: string, patch: Partial<Phase>) =>
    setPayment((p) => ({ ...p, phases: p.phases.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const removePhase = (id: string) =>
    setPayment((p) => ({ ...p, phases: p.phases.filter((x) => x.id !== id) }));
  const addPhase = () =>
    setPayment((p) => ({
      ...p,
      phases: [...p.phases, { id: `ph-${Date.now() % 100000}-${p.phases.length}`, name: "New phase", pct: 0, milestone: "" }],
    }));

  // Effective per-phase retainage %: 0 when off, per-phase in manual, global in auto.
  const phaseRetPct = (p: Phase) => (retEnabled ? (payManual ? p.retentionPct ?? retention : retention) : 0);
  const sumPct = phases.reduce((a, p) => a + p.pct, 0);
  const rows = phases.map((p) => {
    const amount = (developmentCost * p.pct) / 100;
    const rpct = phaseRetPct(p);
    const held = (amount * rpct) / 100;
    return { p, amount, rpct, held, net: amount - held };
  });
  const retentionHeldTotal = rows.reduce((a, r) => a + r.held, 0);
  const totalAmount = rows.reduce((a, r) => a + r.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary band */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total Development Cost" value={money(developmentCost)} tone="text-fg" sub={`Direct ${money(directCost)}${gcAmount ? ` + GC ${money(gcAmount)}` : ""} + Risk&Profit ${est.profitPct}% + BBO ${est.bboPct}%`} icon={<Coins className="h-4 w-4 text-emerald-600" />} />
        <Stat label="Labour hours" value={`${nf0(totalHours)} h`} tone="text-fg" icon={<Clock className="h-4 w-4 text-blue-600" />} />
        <Stat label="Duration" value={`${totalDays} d · ${nf1(weeks)} wk`} tone="text-fg" icon={<CalendarClock className="h-4 w-4 text-amber-600" />} />
        <Stat label="Draw phases" value={`${phases.length}`} tone={sumPct === 100 ? "text-emerald-400" : "text-red-600"} icon={<Landmark className="h-4 w-4 text-violet-600" />} sub={`${nf1(sumPct)}% allocated`} />
      </div>

      {/* ---- Time-Schedule Coupler ---- */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg"><CalendarClock className="h-4 w-4 text-brand" /> Time-Schedule Coupler</div>
          <Badge tone={schedManual ? "blue" : "slate"}>{schedManual ? "Customized" : "Automatic"}</Badge>
          {schedManual ? (
            <label className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
              <Clock className="h-3.5 w-3.5 text-faint" /> Hours / day
              <input type="number" min={1} value={hoursPerDay} onChange={(e) => setHoursPerDay(Math.max(1, Number(e.target.value) || 1))} className="w-12 bg-transparent text-right text-xs font-medium text-fg outline-none" />
            </label>
          ) : (
            <span className="ml-auto text-xs text-muted">{hoursPerDay} h/day · default crew</span>
          )}
          <button type="button" onClick={() => setSchedManual((v) => !v)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${schedManual ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> {schedManual ? "Done" : "Customize"}
          </button>
        </div>
        {schedManual ? (
          <div className="grid grid-cols-2 gap-3 border-b border-border bg-surface-2/30 px-4 py-3 sm:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">Working days / week</span>
              <select value={workingDaysPerWeek} onChange={(e) => setWorkingDaysPerWeek(Number(e.target.value))} className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30">
                <option value={5}>5 (Mon–Fri)</option>
                <option value={6}>6 (Mon–Sat)</option>
                <option value={7}>7 (all days)</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">Section overlap %</span>
              <input type="number" min={0} max={90} value={overlapPct} onChange={(e) => setOverlapPct(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-right text-xs tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">Contingency days</span>
              <input type="number" min={0} value={contingencyDays} onChange={(e) => setContingencyDays(Math.max(0, Number(e.target.value) || 0))} className="h-8 w-full rounded-lg border border-border bg-surface px-2 text-right text-xs tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30" />
            </label>
            <div className="col-span-2 text-xs text-muted sm:col-span-4">
              {startDate ? (
                <>Programme: <span className="font-medium text-fg">{startDate}</span> → <span className="font-medium text-fg">{endDate}</span> · </>
              ) : null}
              {nf1(weeks)} weeks · {workingDaysPerWeek}-day week{overlapPct ? ` · ${overlapPct}% overlap` : ""}{contingencyDays ? ` · +${contingencyDays}d contingency` : ""}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="whitespace-nowrap border-b border-border px-2 py-1.5 text-left text-faint">Section</th>
                <th className="whitespace-nowrap border-b border-border px-1.5 py-1.5 text-right text-faint">Hours</th>
                <th className="whitespace-nowrap border-b border-border px-1.5 py-1.5 text-center text-faint">Crew</th>
                <th className="whitespace-nowrap border-b border-border px-1.5 py-1.5 text-right text-faint">Days</th>
                <th className="whitespace-nowrap border-b border-border px-1.5 py-1.5 text-center text-faint">Range</th>
                <th className="w-full border-b border-l border-border px-2 py-1.5 text-left text-faint">Schedule</th>
                <th className="whitespace-nowrap border-b border-l border-border bg-green-600/20 px-2 py-1.5 text-right text-faint">Cost</th>
              </tr>
            </thead>
            <tbody>
              {sched.map((s) => (
                <tr key={s.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2">
                  <td className="whitespace-nowrap px-2 py-1.5 text-xs font-medium text-fg">{s.name}</td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right text-xs tabular-nums text-muted">{nf0(s.hours)}</td>
                  <td className="px-1.5 py-1 text-center">
                    {schedManual ? (
                      <span className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5">
                        <Users className="h-3 w-3 text-faint" />
                        <input type="number" min={1} value={crew[s.id] ?? 6} onChange={(e) => setCrewFor(s.id, Number(e.target.value) || 1)} className="w-8 bg-transparent py-0.5 text-right text-xs tabular-nums text-fg outline-none" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted"><Users className="h-3 w-3 text-faint" />{crew[s.id] ?? 6}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right text-xs font-semibold tabular-nums text-fg">{s.days}</td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-center text-[11px] tabular-nums text-muted">{s.days ? `${s.start + 1}–${s.end}` : "—"}</td>
                  <td className="w-full px-2 py-1.5">
                    {totalDays > 0 && s.days > 0 ? (
                      <div className="relative h-3 w-full min-w-[280px] rounded bg-surface-2">
                        <div className="absolute top-0 h-3 rounded bg-blue-500/80" style={{ left: `${(s.start / totalDays) * 100}%`, width: `${(s.days / totalDays) * 100}%` }} />
                      </div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap border-l border-green-500/20 bg-green-500/10 px-2 py-1.5 text-right text-xs font-medium tabular-nums text-green-400">{money(s.cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface text-xs font-bold">
                <td className="px-3 py-2 uppercase tracking-wide text-fg">Project</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg">{nf0(totalHours)}</td>
                <td />
                <td className="px-3 py-2 text-right tabular-nums text-fg">{totalDays}</td>
                <td className="px-3 py-2 text-center text-[11px] text-muted">{nf1(weeks)} wks</td>
                <td />
                <td className="border-l border-green-500/20 px-3 py-2 text-right tabular-nums text-green-400">{money(grandCost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-faint">
          {schedManual
            ? "Sections run sequentially. Cost-loaded so each phase carries its share of the budget — adjust crew sizes, dates and overlap to compress or extend the programme."
            : "Automatic programme from default crews. Click Customize to set the start date, crew sizes, working week, overlap and contingency."}
        </p>
      </Card>

      {/* ---- Payment Phase Configurator (PayApp) ---- */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg"><Landmark className="h-4 w-4 text-brand" /> Payment Phase Configurator <span className="text-faint">(PayApp)</span></div>
          <Badge tone={payManual ? "blue" : "slate"}>{payManual ? "Customized" : "Automatic"}</Badge>

          {/* Retainage toggle (off by default) */}
          <button
            type="button"
            onClick={() => setRetEnabled(!retEnabled)}
            title="Retainage — hold a % of each draw when the contractor has no performance bond / bank guarantee in place."
            className={`ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${retEnabled ? "border-amber-500/50 bg-amber-500/10 text-amber-500" : "border-border bg-surface text-muted hover:bg-surface-2"}`}
          >
            <Shield className="h-3.5 w-3.5" /> Retainage {retEnabled ? "On" : "Off"}
          </button>
          {retEnabled && !payManual ? (
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
              Rate
              <input type="number" min={0} max={20} value={retention} onChange={(e) => setRetention(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} className="w-10 bg-transparent text-right text-xs font-medium text-fg outline-none" />%
            </label>
          ) : null}
          {retEnabled && payManual ? <span className="text-[11px] text-amber-500/80">per-phase %</span> : null}

          <button type="button" onClick={() => setPayManual(!payManual)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors ${payManual ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> {payManual ? "Done" : "Customize"}
          </button>
          {sumPct === 100 ? <Badge tone="green">balanced 100%</Badge> : <Badge tone="red">{nf1(sumPct)}% — must equal 100%</Badge>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="border-b border-border px-3 py-1.5 text-left text-faint">#</th>
                <th className="border-b border-border px-3 py-1.5 text-left text-faint">Draw phase</th>
                <th className="border-b border-border px-3 py-1.5 text-left text-faint">Disbursement trigger / milestone</th>
                <th className="border-b border-border px-3 py-1.5 text-right text-faint">% </th>
                <th className="border-b border-l border-border bg-green-600/20 px-3 py-1.5 text-right text-faint">Draw amount</th>
                <th className="border-b border-border px-3 py-1.5 text-right text-faint">Retainage</th>
                <th className="border-b border-border px-3 py-1.5 text-right text-faint">Net release</th>
                {payManual ? <th className="no-print border-b border-border px-1 py-1.5" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, amount, rpct, held, net }, i) => (
                <tr key={p.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2">
                  <td className="px-3 py-1.5 text-[11px] tabular-nums text-faint">{i + 1}</td>
                  <td className="px-2 py-1">
                    {payManual ? (
                      <input value={p.name} onChange={(e) => patchPhase(p.id, { name: e.target.value })} className="w-full min-w-[140px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
                    ) : (
                      <span className="block min-w-[140px] px-1 text-xs font-medium text-fg">{p.name}</span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {payManual ? (
                      <input value={p.milestone} onChange={(e) => patchPhase(p.id, { milestone: e.target.value })} className="w-full min-w-[200px] rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
                    ) : (
                      <span className="block min-w-[200px] px-1 text-[11px] text-muted">{p.milestone}</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {payManual ? (
                      <input type="number" value={p.pct} onChange={(e) => patchPhase(p.id, { pct: Number(e.target.value) || 0 })} className="w-14 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs tabular-nums text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
                    ) : (
                      <span className="block px-1 text-right text-xs tabular-nums text-fg">{nf1(p.pct)}%</span>
                    )}
                  </td>
                  <td className="border-l border-green-500/20 bg-green-500/10 px-3 py-1.5 text-right text-xs font-medium tabular-nums text-green-400">{money(amount)}</td>
                  <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-amber-400">
                    {!retEnabled ? (
                      <span className="text-faint">—</span>
                    ) : payManual ? (
                      <span className="inline-flex items-center justify-end gap-1">
                        <input type="number" min={0} max={20} value={p.retentionPct ?? retention} onChange={(e) => patchPhase(p.id, { retentionPct: Math.max(0, Math.min(20, Number(e.target.value) || 0)) })} className="w-10 rounded border border-amber-500/30 bg-amber-500/5 px-1 py-0.5 text-right text-[11px] tabular-nums text-amber-400 outline-none focus:ring-1 focus:ring-amber-500/30" title="Retainage % held from this phase" />
                        <span className="text-faint">%</span>
                        <span className="w-16 text-right">{money(held)}</span>
                      </span>
                    ) : (
                      <span>{rpct}% · {money(held)}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums text-fg">{money(net)}</td>
                  {payManual ? (
                    <td className="no-print px-1 py-1 text-center">
                      <button type="button" onClick={() => removePhase(p.id)} aria-label="Remove phase" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-surface text-xs font-bold">
                <td />
                <td className="px-3 py-2 uppercase tracking-wide text-fg" colSpan={2}>Total disbursement</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg">{nf1(sumPct)}%</td>
                <td className="border-l border-green-500/20 px-3 py-2 text-right tabular-nums text-green-400">{money(totalAmount)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-400">{retEnabled ? money(retentionHeldTotal) : "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-fg">{money(totalAmount - retentionHeldTotal)}</td>
                {payManual ? <td className="no-print" /> : null}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-3">
          {payManual ? (
            <button type="button" onClick={addPhase} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2"><Plus className="h-3.5 w-3.5" /> Add draw phase</button>
          ) : null}
          <p className="text-[11px] text-faint">
            <span className="text-muted">Draws are % of the Total Development Cost ({money(developmentCost)}) — direct cost{gcAmount ? " + General Conditions" : ""} + Risk&nbsp;&amp;&nbsp;Profit + BBO.</span>{" "}
            {!retEnabled
              ? "Retainage is OFF — full draws are released. Turn it on to hold a % when no performance bond / bank guarantee is posted."
              : payManual
                ? `Per-phase retainage held (${money(retentionHeldTotal)} total), released at final completion. Set each phase's % by risk/complexity.`
                : `Retainage of ${retention}% is held from each draw and released at final completion (${money(retentionHeldTotal)} total).`}
          </p>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: string; icon: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">{icon} {label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </Card>
  );
}
