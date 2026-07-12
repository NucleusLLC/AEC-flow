/**
 * Budget & Timeline — pure compute shared by the interactive Budget tab
 * (`BudgetTimelineView`) and the print document (`EstimatePrintDoc`), so the
 * printed "Time-Schedule Coupler" and "Payment Phase Configurator" pages reflect
 * exactly what the user configured.
 *
 * Client-safe: depends only on the CostEstimate *type* (no Prisma / `@/lib/db`).
 */

import type { CostEstimate } from "@/lib/data/estimates";
import { calcItem } from "@/lib/estimates/calc";

export type Phase = {
  id: string;
  name: string;
  pct: number;
  milestone: string;
  /** Manual-mode retainage % held from THIS phase's draw (falls back to the global rate). */
  retentionPct?: number;
};

/** Research-based default construction-loan draw schedule (sums to 100%). */
export const DEFAULT_PHASES: Omit<Phase, "id">[] = [
  { name: "Deposit / Mobilization", pct: 10, milestone: "Contract signed · permits · site setup" },
  { name: "Foundation", pct: 15, milestone: "Foundations & ground slab complete" },
  { name: "Structure / Framing", pct: 20, milestone: "Superstructure / framing complete" },
  { name: "Roof & Dry-in", pct: 15, milestone: "Roof on · building weather-tight" },
  { name: "MEP Rough-in", pct: 15, milestone: "Electrical · plumbing · HVAC rough-in" },
  { name: "Finishes", pct: 15, milestone: "Plaster · tiling · painting · fit-out" },
  { name: "Completion / Handover", pct: 10, milestone: "Snagging · CO · handover" },
];

export interface ScheduleConfig {
  hoursPerDay: number;
  crew: Record<string, number>;
  startDate: string;
  workingDaysPerWeek: number;
  overlapPct: number;
  contingencyDays: number;
}

export interface PaymentConfig {
  /** Global retainage % — used in "auto" mode and as the default for per-phase manual entry. */
  retention: number;
  /**
   * Retainage toggle. OFF by default — retainage is only held when the contractor has
   * NOT posted a performance bond / bank guarantee (typically 5–10%). When off, no money
   * is withheld from any draw.
   */
  retentionEnabled?: boolean;
  /** "auto" = one global % across all phases; "manual" = per-phase % (Phase.retentionPct). */
  retentionMode?: "auto" | "manual";
  phases: Phase[];
}

export const defaultSchedule = (est: CostEstimate): ScheduleConfig => ({
  hoursPerDay: 8,
  crew: Object.fromEntries(est.categories.map((c) => [c.id, 6])),
  startDate: "",
  workingDaysPerWeek: 5,
  overlapPct: 0,
  contingencyDays: 0,
});

export const defaultPayment = (): PaymentConfig => ({
  retention: 5,
  retentionEnabled: false, // off until a bond/guarantee gap requires withholding
  retentionMode: "auto",
  phases: DEFAULT_PHASES.map((p, i) => ({ ...p, id: `ph-${i}` })),
});

/** Add `n` working days to an ISO date, honouring the working-days-per-week setting. */
export function addWorkingDays(startISO: string, n: number, dpw: number): string {
  if (!startISO) return "";
  const d = new Date(startISO + "T00:00:00");
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay(); // 0 Sun … 6 Sat
    const working = dpw >= 7 ? true : dpw === 6 ? dow !== 0 : dow !== 0 && dow !== 6;
    if (working) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

export interface SectionCost {
  id: string;
  name: string;
  hours: number;
  cost: number;
}

/**
 * Per-section labour hours + fully-loaded cost (labour + material + equip + sub).
 * Computed through `calcItem` — the single source of truth — so the Schedule Coupler
 * and PayApp use exactly the same numbers as the editor, summary, and PDF, regardless
 * of each line's calculation method (Norm / Labor-Rate / Assembly).
 */
export function computeSections(est: CostEstimate): SectionCost[] {
  const rate = est.avgLaborRate;
  return est.categories.map((c) => {
    let hours = 0;
    let cost = 0;
    for (const it of c.items) {
      const calc = calcItem(it, rate);
      hours += calc.hrs;
      cost += calc.total;
    }
    return { id: c.id, name: c.name, hours, cost };
  });
}

export function computeGrandCost(est: CostEstimate): number {
  return computeSections(est).reduce((a, s) => a + s.cost, 0);
}

/**
 * Total Development Cost — the full contract price the disbursement schedule must draw
 * against. Mirrors the estimate summary's Grand Total buildup exactly:
 *   (direct cost + General Conditions / Overhead) × (1 + Risk&Profit% + BBO%)
 * so every phase draw is a share of what the client actually pays — labour, material,
 * equipment, subs, overhead, General Conditions, plus BBO and Risk & Profit — not the
 * bare direct cost. `gcAmount` is the enabled General Conditions total (0 when the
 * estimate's GC line is inactive), passed in because that data lives outside CostEstimate.
 */
export function computeDevelopmentCost(est: CostEstimate, gcAmount = 0): number {
  const base = computeGrandCost(est) + gcAmount;
  const profit = (base * (est.profitPct || 0)) / 100;
  const bbo = (base * (est.bboPct || 0)) / 100;
  return base + profit + bbo;
}

export interface ScheduledSection extends SectionCost {
  crew: number;
  days: number;
  start: number;
  end: number;
}

export interface ScheduleResult {
  sections: SectionCost[];
  sched: ScheduledSection[];
  grandCost: number;
  totalHours: number;
  totalDays: number;
  weeks: number;
  endDate: string;
}

export function computeSchedule(est: CostEstimate, cfg: ScheduleConfig): ScheduleResult {
  const sections = computeSections(est);
  const grandCost = sections.reduce((a, s) => a + s.cost, 0);
  const totalHours = sections.reduce((a, s) => a + s.hours, 0);

  const crewOf = (id: string) => cfg.crew[id] || 6;
  const daysOf = (id: string, hours: number) =>
    hours > 0 ? Math.ceil(hours / (crewOf(id) * cfg.hoursPerDay)) : 0;

  const dayList = sections.map((s) => daysOf(s.id, s.hours));
  // Sequential by default; overlap lets each section start before the previous ends.
  const startList = dayList.reduce<number[]>((acc, _d, i) => {
    if (i === 0) return [0];
    const next = acc[i - 1] + dayList[i - 1] - Math.round((dayList[i - 1] * cfg.overlapPct) / 100);
    return [...acc, Math.max(0, next)];
  }, []);
  const sched: ScheduledSection[] = sections.map((s, i) => ({
    ...s,
    crew: crewOf(s.id),
    days: dayList[i],
    start: startList[i],
    end: startList[i] + dayList[i],
  }));
  const lastDay = sched.reduce((m, s) => Math.max(m, s.end), 0);
  const totalDays = lastDay + cfg.contingencyDays;
  const weeks = cfg.workingDaysPerWeek > 0 ? totalDays / cfg.workingDaysPerWeek : 0;
  const endDate = cfg.startDate ? addWorkingDays(cfg.startDate, totalDays, cfg.workingDaysPerWeek) : "";

  return { sections, sched, grandCost, totalHours, totalDays, weeks, endDate };
}

export interface DrawRow extends Phase {
  amount: number;
  held: number;
  net: number;
}

export interface DrawResult {
  grandCost: number;
  rows: DrawRow[];
  sumPct: number;
  totalAmount: number;
  totalHeld: number;
  totalNet: number;
}

/**
 * Draw schedule. When `importedAmount` > 0 (the Imported Materials, Equipment &
 * Logistics line is active), that amount is carved OUT of the normal phased
 * distribution and disbursed 50% up front (procurement / shipping deposit) and
 * 50% at mid-project (delivery on site) — so the imported procurement isn't
 * double-paid through the regular phases. With `importedAmount` = 0 this is
 * identical to the plain phase schedule.
 */
export function computeDraws(est: CostEstimate, payment: PaymentConfig, importedAmount = 0, gcAmount = 0): DrawResult {
  // Draws are shares of the Total Development Cost (direct + General Conditions,
  // marked up by Risk & Profit + BBO) — the actual contract price — NOT the bare
  // direct cost. Keeps the disbursement total equal to the estimate's Grand Total.
  const grandCost = computeDevelopmentCost(est, gcAmount);
  const imported = Math.max(0, Math.min(importedAmount, grandCost));
  const base = grandCost - imported; // non-imported cost spread across the normal phases
  const pctOf = (amount: number) => (grandCost > 0 ? (amount / grandCost) * 100 : 0);
  // Effective retainage % for a phase: 0 when the toggle is off; the per-phase rate in
  // manual mode (falling back to the global rate); the global rate in auto mode.
  const retentionPctFor = (p: Phase): number => {
    if (!payment.retentionEnabled) return 0;
    return payment.retentionMode === "manual" ? p.retentionPct ?? payment.retention : payment.retention;
  };
  const draw = (p: Phase, amount: number): DrawRow => {
    const held = amount * (retentionPctFor(p) / 100);
    return { ...p, pct: pctOf(amount), amount, held, net: amount - held };
  };
  const normal = payment.phases.map((p) => draw(p, (base * p.pct) / 100));

  let rows: DrawRow[] = normal;
  if (imported > 0) {
    const dep = draw(
      { id: "imel-dep", name: "Imported Mat./Equip. & Logistics — Deposit", pct: 0, milestone: "Order & ship imported materials / equipment (50%)" },
      imported / 2,
    );
    const del = draw(
      { id: "imel-del", name: "Imported Mat./Equip. & Logistics — Delivery", pct: 0, milestone: "Delivered on site · mid-project (50%)" },
      imported / 2,
    );
    const mid = Math.max(1, Math.ceil(normal.length / 2));
    // Deposit right after the opening mobilization draw; delivery at the midpoint.
    rows = [...normal.slice(0, 1), dep, ...normal.slice(1, mid), del, ...normal.slice(mid)];
  }

  const sumPct = rows.reduce((a, r) => a + r.pct, 0);
  const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
  const totalHeld = rows.reduce((a, r) => a + r.held, 0);
  return { grandCost, rows, sumPct, totalAmount, totalHeld, totalNet: totalAmount - totalHeld };
}
