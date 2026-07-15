"use client";

/**
 * EstimatePrintDoc — Pass-2 renderer for the Smart Page-Break Engine.
 *
 * It runs the measurement-first engine (Pass 1) via `simulateReportPages`, then
 * renders each page EXACTLY according to the returned pagination map: every block
 * is positioned at its measured Y and drawn at its measured height. No page break
 * is recalculated during rendering, so rows are never cut and content never
 * overlaps. Small / Normal / Medium drive the heights through the TextSizeProfile.
 */

import { useEffect, useMemo } from "react";
import type { CostEstimate } from "@/lib/data/estimates";
import { sumGeneralConditions, type GeneralConditionItem } from "@/lib/data/general-conditions";
import { calcItem } from "@/lib/estimates/calc";
import {
  computeSchedule,
  computeDraws,
  type ScheduleConfig,
  type PaymentConfig,
} from "@/lib/estimates/budget-timeline";
import {
  simulateReportPages,
  validatePagination,
  calculatePrintableArea,
  calculateTextHeight,
  measureGrandTotalBlock,
  getTextSizeProfile,
  PAGE_BREAK_SAFETY_BUFFER,
  type TextSize,
  type LayoutContext,
  type PageSettings,
  type ReportData,
  type ReportCategory,
  type ColumnWidths,
  type GrandTotalRow,
  type MeasuredBlock,
} from "@/lib/estimates/pagination-engine";

const MM = 96 / 25.4;

export interface PrintControl {
  labor: boolean;
  material: boolean;
  equipment: boolean;
  subcontractor: boolean;
  qtyUnit: boolean;
  pageNum: boolean;
  generalConditions: boolean;
  zebra: boolean;
  /** Show the section total (bold) + % share on the shaded category header row. */
  rowSubtotal: boolean;
  /** Show the company logo at the top-right of every page. */
  logo: boolean;
  /** Append the Time-Schedule Coupler page. */
  timeline: boolean;
  /** Append the Payment Phase Configurator page. */
  phaseDisbursement: boolean;
  /** Print the free-text Memo / Remark on the cover page under the Cost Summary. */
  memo: boolean;
  /** Print a cost-breakdown chart on the cover page. */
  chart: boolean;
  /**
   * Break out Imported Materials, Equipment & Logistics: shown as its own segment
   * in the Cost Summary / pie & bar chart, and disbursed 50% deposit / 50% delivery
   * in the Payment Phase Configurator.
   */
  importedMaterials: boolean;
  /**
   * Optional: annotate each line with its calculation method (Norm / Labor-Rate /
   * Assembly). OFF by default — the main table keeps its standard columns and labels.
   */
  methodDetail?: boolean;
  /**
   * Rate columns — the per-unit inputs BEHIND each cost column, printed next to the
   * cost they produce (Norm hrs/u → Hrs → Labor, Mat./u → Material, …). All OFF by
   * default: the standard sheet shows costs, and these widen the table. Optional so a
   * print template saved before they existed still loads.
   */
  laborNorm?: boolean;
  laborHrs?: boolean;
  materialUnit?: boolean;
  equipmentUnit?: boolean;
  subUnit?: boolean;
  /**
   * Section ids that print COLLAPSED — header + subtotal, no line items. Lets a client
   * copy summarise a section (or the whole sheet) without deleting anything: the numbers
   * still roll up from the real lines, they're just not itemised.
   */
  collapsedSections?: string[];
}

/** Subtle, print-friendly band colour for alternating item rows. */
const ZEBRA_FILL = "#f3f4f6";

/** Rate columns are decimals (0.35 hrs/u, 12.50 /u) — the cost columns stay whole (nf0). */
const nfRate = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Short label per calculation method — appended to a line only when the optional
 *  "method details" report setting is ON (pc.methodDetail). Default OFF → no tag. */
const METHOD_TAG: Record<string, string> = { norm: "Norm", labor_rate: "$/unit", assembly: "Assembly" };

/** ZenArch brand mark, drawn inline (no asset dependency) for the print header. */
function EstimateLogo({ size }: { size: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.28 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#1e293b"
          strokeWidth="7"
          strokeDasharray="205 70"
          strokeLinecap="round"
          transform="rotate(-35 50 50)"
        />
        <circle cx="50" cy="50" r="19" fill="none" stroke="#1e293b" strokeWidth="6" />
      </svg>
      <div style={{ lineHeight: 1 }}>
        <div
          style={{
            fontWeight: 800,
            letterSpacing: size * 0.05,
            fontSize: size * 0.44,
            color: "#1e293b",
          }}
        >
          ZENARCH
        </div>
        <div
          style={{
            fontSize: size * 0.15,
            letterSpacing: size * 0.035,
            color: "#64748b",
            marginTop: size * 0.06,
          }}
        >
          ARCHITECTURE + DEVELOPMENT
        </div>
      </div>
    </div>
  );
}

interface ColDef {
  key: string;
  label: string;
  width: number; // px (fixed) — description is the flexible remainder
  align: "left" | "right";
  flexible?: boolean;
}

export interface EstimatePrintDocProps {
  est: CostEstimate;
  rate: number;
  textSize: TextSize;
  paper: "A4" | "A3";
  orient: "landscape" | "portrait";
  pc: PrintControl;
  showProgress: boolean;
  grandTotalRows: GrandTotalRow[];
  notes?: string;
  /** General Conditions items — printed as their own section when the toggle is on. */
  generalConditions?: GeneralConditionItem[];
  gcActive?: boolean;
  /** Budget & Timeline config — drives the optional Timeline / Phase pages. */
  schedule?: ScheduleConfig;
  payment?: PaymentConfig;
  /** Free-text memo/remark shown on the cover page under the Cost Summary. */
  memo?: string;
  /** Practice logo (data URL) from Settings → Practice; falls back to the ZenArch mark. */
  logoDataUrl?: string | null;
  /** Logo scale multiplier (1 = default). */
  logoScale?: number;
  /** Footer line (Settings → Practice → Footer Text) + its font. */
  footerText?: string;
  footerFontFamily?: string;
  footerFontSize?: number;
  /**
   * Cost-breakdown chart segments (cover page) — raw amounts + colours.
   * `pctOverride` forces the displayed % (used so Profit & Risk / BBO read their
   * markup rate, matching the summary, instead of their share of the total).
   * `amount` overrides the formatted amount string (used for the USD alt-unit).
   */
  chartData?: { label: string; value: number; color: string; pctOverride?: number; amount?: string }[];
  /** Imported Materials, Equipment & Logistics total — drives the 50/50 disbursement carve-out. */
  importedAmount?: number;
  /** Cover page — a leading title page with the project's headline facts + a rendering. */
  coverPage?: boolean;
  coverImage?: string | null;
  /** Pre-formatted grand total for the cover (carries the dual-currency string when on). */
  coverTotalDisplay?: string;
  /**
   * USD secondary unit: when on, every total/amount prints as "$ <usd> · <currency> <n>"
   * ($ to the LEFT of the system unit). Only the total/amount columns go dual — the
   * labour/material/equipment/sub breakdown columns stay single-unit to remain legible.
   */
  usdSecondary?: boolean;
  usdRate?: number;
  nf0: (n: number) => string;
  debug?: boolean;
  /** Reports the computed page count back to the parent (for the preview chrome). */
  onPages?: (count: number) => void;
}

/** Build the page geometry (px) from paper + orientation + text size. */
function buildPageSettings(
  paper: "A4" | "A3",
  orient: "landscape" | "portrait",
  textSize: TextSize,
): PageSettings {
  const profile = getTextSizeProfile(textSize);
  const [shortMm, longMm] = paper === "A4" ? [210, 297] : [297, 420];
  const wMm = orient === "landscape" ? longMm : shortMm;
  const hMm = orient === "landscape" ? shortMm : longMm;
  return {
    pageWidth: Math.round(wMm * MM),
    // −1px so a rounded-up page can never exceed the physical sheet and spill a
    // blank page after each page when printing.
    pageHeight: Math.round(hMm * MM) - 1,
    // Printer-safe margins. Physical printers have a ~5–8mm non-printable hardware
    // border; with @page margin:0 (the engine owns layout), content inside this
    // border would be clipped or rescaled on paper even though a PDF looks fine.
    // Insetting content ≥8mm keeps it inside any printer's printable area, so the
    // printout matches the preview/PDF exactly.
    marginTop: Math.round(8 * MM),
    marginBottom: Math.round(11 * MM),
    marginLeft: Math.round(8 * MM),
    marginRight: Math.round(8 * MM),
    headerHeight: Math.round(profile.titleHeight + profile.lineHeight * 2 + profile.verticalPadding * 3),
    footerHeight: Math.round(profile.lineHeight + profile.verticalPadding * 2),
  };
}

/** Active columns given the Print Control toggles + Progress. */
function buildColumns(pc: PrintControl, showProgress: boolean, usd: boolean): ColDef[] {
  const cols: (ColDef | false)[] = [
    { key: "code", label: "Code", width: 84, align: "left" },
    { key: "desc", label: "Description", width: 0, align: "left", flexible: true },
    pc.qtyUnit && { key: "qty", label: "Qty", width: 46, align: "right" },
    pc.qtyUnit && { key: "unit", label: "Unit", width: 46, align: "left" },
    // Each optional rate column sits immediately LEFT of the cost it produces, so the
    // sheet reads input → output across the row.
    !!pc.laborNorm && { key: "norm", label: "Norm hrs/u", width: 62, align: "right" },
    !!pc.laborHrs && { key: "hrs", label: "Hrs", width: 52, align: "right" },
    pc.labor && { key: "labor", label: "Labor", width: 82, align: "right" },
    !!pc.materialUnit && { key: "matUnit", label: "Mat. /u", width: 66, align: "right" },
    pc.material && { key: "material", label: "Material", width: 82, align: "right" },
    !!pc.equipmentUnit && { key: "equipUnit", label: "Equip. /u", width: 66, align: "right" },
    pc.equipment && { key: "equipment", label: "Equip.", width: 82, align: "right" },
    !!pc.subUnit && { key: "subUnit", label: "Subc. /u", width: 66, align: "right" },
    pc.subcontractor && { key: "sub", label: "Subcont.", width: 82, align: "right" },
    // The Total column goes dual-currency ("$ … · AWG …") when USD is on, so it needs
    // room for both figures.
    { key: "total", label: "Total", width: usd ? 148 : 92, align: "right" },
    showProgress && { key: "poc", label: "POC%", width: 50, align: "right" },
    showProgress && { key: "prog", label: "Prog.", width: 78, align: "right" },
  ];
  return cols.filter(Boolean) as ColDef[];
}

/** Money formatter for the print doc — dual-currency ($ left of the system unit) when USD is on. */
function makeMoney(currency: string, nf0: (n: number) => string, usd?: boolean, rate?: number) {
  return (n: number) => (usd ? `$ ${nf0(n * (rate ?? 0))} · ${currency} ${nf0(n)}` : `${currency} ${nf0(n)}`);
}

/** Convert the estimate into the engine's ReportData + measured column widths. */
function buildReportData(
  props: EstimatePrintDocProps,
  columns: ColDef[],
  printableWidth: number,
): { reportData: ReportData; columnWidths: ColumnWidths } {
  const { est, rate, nf0, pc, grandTotalRows, notes, generalConditions, gcActive } = props;
  // The Total/amount columns print dual-currency ($ left of the system unit) when USD is on.
  const dualMoney = makeMoney(est.currency, nf0, props.usdSecondary, props.usdRate);

  const fixed = columns.filter((c) => !c.flexible).reduce((s, c) => s + c.width, 0);
  const descriptionWidth = Math.max(80, printableWidth - fixed);

  // Single source of truth for per-line math (see lib/estimates/calc.ts) — the print
  // table, the editor, and the schedule/PayApp all compute through calcItem so the
  // PDF number is always exactly the on-screen number.
  const calc = (it: CostEstimate["categories"][number]["items"][number]) =>
    calcItem(it, rate);

  const grandDirect = est.categories.reduce(
    (s, cat) => s + cat.items.reduce((a, it) => a + calc(it).total, 0),
    0,
  );
  let zebraIdx = 0; // continuous parity across the whole sheet
  const categories: ReportCategory[] = est.categories.map((cat) => {
    const ct = cat.items.reduce(
      (a, it) => {
        const c = calc(it);
        return {
          hrs: a.hrs + c.hrs,
          labor: a.labor + c.labor,
          mat: a.mat + c.mat,
          equip: a.equip + c.equip,
          sub: a.sub + c.sub,
          total: a.total + c.total,
          prog: a.prog + c.prog,
        };
      },
      { hrs: 0, labor: 0, mat: 0, equip: 0, sub: 0, total: 0, prog: 0 },
    );
    const pocPct = ct.total > 0 ? (ct.prog / ct.total) * 100 : 0;
    // Collapsed: the section prints as its header + subtotal only. The totals above are
    // computed from the real items FIRST, so a collapsed section still carries its full
    // cost into the subtotal, the summary and the grand total — nothing is dropped, only
    // un-itemised.
    const isCollapsed = (pc.collapsedSections ?? []).includes(cat.id);
    return {
      id: cat.id,
      code: cat.code,
      name: cat.name,
      subtotalDisplay: dualMoney(ct.total),
      sharePctDisplay: `${nf0(grandDirect > 0 ? (ct.total / grandDirect) * 100 : 0)}%`,
      items: (isCollapsed ? [] : cat.items).map((it) => {
        const c = calc(it);
        return {
          id: it.id,
          code: it.code,
          description: pc.methodDetail
            ? `${it.task || "—"}  ·  [${METHOD_TAG[it.calculationMethod ?? "norm"]}]`
            : it.task || "—",
          unit: pc.qtyUnit ? it.unit : undefined,
          zebra: zebraIdx++ % 2 === 1,
          values: {
            code: it.code ?? "",
            qty: it.qty ? nf0(it.qty) : "",
            unit: it.unit,
            norm: nfRate(it.laborNorm),
            hrs: nfRate(c.hrs),
            labor: nf0(c.labor),
            matUnit: nfRate(it.materialUnitCost),
            material: nf0(c.mat),
            equipUnit: nfRate(it.equipmentUnitCost),
            equipment: nf0(c.equip),
            subUnit: nfRate(it.subcontractUnitCost),
            sub: nf0(c.sub),
            total: dualMoney(c.total),
            poc: `${nf0(it.poc)}%`,
            prog: nf0(c.prog),
          },
        };
      }),
      subtotal: {
        id: cat.id,
        label: `Subtotal — ${cat.name}`,
        values: {
          // Hours add up; the per-unit RATE columns don't (a sum of rates is meaningless),
          // so they're deliberately absent here and render blank.
          hrs: nfRate(ct.hrs),
          labor: nf0(ct.labor),
          material: nf0(ct.mat),
          equipment: nf0(ct.equip),
          sub: nf0(ct.sub),
          total: dualMoney(ct.total),
          poc: `${nf0(pocPct)}%`,
          prog: nf0(ct.prog),
        },
      },
    };
  });

  // Detail-breakdown appendices (General Conditions, Imported Materials). These are NOT
  // part of the core Cost Estimation sheet, so they print AFTER the Cost Summary —
  // the summary concludes the main BoQ; these read as supporting appendices.
  const appendixCategories: ReportCategory[] = [];

  // General Conditions section — its own page, listing every enabled GC item.
  if (pc.generalConditions && gcActive && generalConditions?.length) {
    const enabled = generalConditions.filter((g) => g.enabled);
    if (enabled.length) {
      const gcTotal = enabled.reduce((s, g) => s + g.qty * g.unitCost, 0);
      const months = enabled.find((g) => g.unit === "month")?.qty;
      appendixCategories.push({
        id: "general-conditions",
        name: months ? `General Conditions / Overhead — ${nf0(months)} project months` : "General Conditions / Overhead",
        pageBreakBefore: true,
        subtotalDisplay: dualMoney(gcTotal),
        items: enabled.map((g, i) => ({
          id: g.id,
          code: "",
          description: g.name || "—",
          unit: pc.qtyUnit ? g.unit : undefined,
          zebra: i % 2 === 1,
          values: {
            qty: nf0(g.qty),
            unit: g.unit,
            total: dualMoney(g.qty * g.unitCost),
          },
        })),
        subtotal: {
          id: "gc",
          label: "Subtotal — General Conditions / Overhead",
          values: { total: dualMoney(gcTotal) },
        },
      });
    }
  }

  // Imported Materials, Equipment & Logistics — its own page, consolidating every
  // line item that carries an imported (Equipment-column) cost into one list, apart
  // from the BoQ rows, so it doubles as a procurement / purchase-order pick list.
  // Added whenever the Print Control toggle is on.
  if (pc.importedMaterials) {
    const imported = est.categories.flatMap((cat) =>
      cat.items
        .map((it) => ({ it, equip: calc(it).equip, section: cat.name }))
        .filter((x) => x.equip > 0),
    );
    if (imported.length) {
      const imTotal = imported.reduce((s, x) => s + x.equip, 0);
      appendixCategories.push({
        id: "imported-materials",
        name: "Imported Materials, Equipment & Logistics",
        pageBreakBefore: true,
        subtotalDisplay: dualMoney(imTotal),
        items: imported.map(({ it, equip, section }, i) => ({
          id: `im-${it.id}`,
          code: it.code,
          description: it.task ? `${it.task}  ·  ${section}` : section,
          unit: pc.qtyUnit ? it.unit : undefined,
          zebra: i % 2 === 1,
          values: {
            code: it.code ?? "",
            qty: it.qty ? nf0(it.qty) : "",
            unit: it.unit,
            total: dualMoney(equip),
          },
        })),
        subtotal: {
          id: "im",
          label: "Subtotal — Imported Materials, Equipment & Logistics",
          values: { total: dualMoney(imTotal) },
        },
      });
    }
  }

  const reportData: ReportData = {
    sheetTitle: est.projectName,
    categories,
    // GC / Imported-Materials breakdowns flow AFTER the Cost Summary.
    appendixCategories,
    grandTotal: grandTotalRows.length ? { rows: grandTotalRows, notes, title: "Cost Summary" } : undefined,
    // The Cost Summary must sit IMMEDIATELY after the last section of the estimation
    // sheet — never forced onto its own page. The engine's placeGrandTotal already
    // keeps it on the current page when it fits and only breaks to the next page if
    // it genuinely doesn't, which is exactly the desired behaviour.
    grandTotalPageBreak: false,
  };
  return { reportData, columnWidths: { description: descriptionWidth } };
}

/** Build the optional Timeline / Phase Disbursement appendix pages (pre-measured). */
function buildAppendixBlocks(
  props: EstimatePrintDocProps,
  profile: ReturnType<typeof getTextSizeProfile>,
): MeasuredBlock[] {
  const { est, pc, nf0, schedule, payment } = props;
  const currency = est.currency;
  // Dual-currency ($ left of the system unit) when USD is on, matching the rest of the report.
  const money = makeMoney(currency, nf0, props.usdSecondary, props.usdRate);
  const usd = !!props.usdSecondary;
  const nf1 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  const blocks: MeasuredBlock[] = [];

  const titleH = profile.titleHeight;
  const metaH = profile.lineHeight + profile.verticalPadding * 2;
  const headH = profile.subcategoryHeaderHeight;
  const rowH = profile.itemRowMinHeight;
  const footH = profile.subtotalRowHeight;
  const pad = profile.verticalPadding * 2;
  const tableHeight = (rows: number) => titleH + metaH + headH + rows * rowH + footH + pad;

  if (pc.timeline && schedule) {
    // Spread the full development cost (direct + GC + Risk&Profit + BBO) across sections,
    // so the coupler's total is the Grand Total, not the bare direct cost.
    const scheduleGc = props.gcActive ? sumGeneralConditions(props.generalConditions ?? []) : 0;
    const r = computeSchedule(est, schedule, scheduleGc);
    const totalDays = r.totalDays || 1;
    const grandCost = r.grandCost || 1;
    const rows = r.sched.map((s) => {
      const pctLabel = `${nf0((s.cost / grandCost) * 100)}%`; // section share of total cost
      return [
        { v: s.name, align: "left" as const },
        { v: nf0(s.hours), align: "right" as const },
        { v: String(s.crew), align: "center" as const },
        { v: String(s.days), align: "right" as const },
        // Gantt bar — positioned by start day, sized by duration; labelled with the cost %.
        {
          gantt: { start: (s.start / totalDays) * 100, width: (s.days / totalDays) * 100 },
          label: s.days ? `Day ${s.start + 1}–${s.end} · ${pctLabel}` : "",
          pct: pctLabel,
        },
        { v: pctLabel, align: "right" as const },
        { v: money(s.cost), align: "right" as const },
      ];
    });
    const meta = `${schedule.startDate ? `${schedule.startDate} → ${r.endDate} · ` : ""}${nf1(r.weeks)} weeks · ${schedule.workingDaysPerWeek}-day week · ${schedule.hoursPerDay}h/day${schedule.overlapPct ? ` · ${schedule.overlapPct}% overlap` : ""}${schedule.contingencyDays ? ` · +${schedule.contingencyDays}d contingency` : ""}`;
    blocks.push({
      id: "timeline",
      type: "timeline",
      keepTogether: true,
      pageBreakBefore: true,
      height: tableHeight(rows.length),
      data: {
        title: "Time-Schedule Coupler",
        meta,
        gridTemplate: `150px 60px 44px 46px minmax(0,1fr) 52px ${usd ? 168 : 104}px`,
        head: [
          { label: "Section", align: "left" },
          { label: "Hours", align: "right" },
          { label: "Crew", align: "center" },
          { label: "Days", align: "right" },
          { label: `Schedule · 0–${r.totalDays} days`, align: "left" },
          { label: "%", align: "right" },
          { label: "Cost", align: "right" },
        ],
        rows,
        foot: [
          { v: "Project", align: "left", bold: true },
          { v: nf0(r.totalHours), align: "right", bold: true },
          { v: "", align: "center" },
          { v: String(r.totalDays), align: "right", bold: true },
          { v: `${r.totalDays} days · ${nf1(r.weeks)} wks`, align: "left" },
          { v: "100%", align: "right", bold: true },
          { v: money(r.grandCost), align: "right", bold: true },
        ],
        titleH, metaH, headH, rowH, footH,
      },
    });
  }

  if (pc.phaseDisbursement && payment) {
    // Disbursement draws against the Total Development Cost — include enabled General
    // Conditions when the GC line is active, mirroring the summary's Grand Total.
    const gcAmount = props.gcActive ? sumGeneralConditions(props.generalConditions ?? []) : 0;
    const d = computeDraws(est, payment, pc.importedMaterials ? props.importedAmount ?? 0 : 0, gcAmount);
    const rows = d.rows.map((p, i) => [
      { v: String(i + 1), align: "left" as const },
      { v: p.name, align: "left" as const },
      { v: p.milestone, align: "left" as const },
      { v: `${nf1(p.pct)}%`, align: "right" as const },
      { v: money(p.amount), align: "right" as const },
      { v: money(p.held), align: "right" as const },
      { v: money(p.net), align: "right" as const },
    ]);
    blocks.push({
      id: "phaseTable",
      type: "phaseTable",
      keepTogether: true,
      pageBreakBefore: true,
      height: tableHeight(rows.length),
      data: {
        title: "Payment Phase Configurator (PayApp)",
        meta: `${
          !payment.retentionEnabled
            ? "No retainage (full draws released)"
            : payment.retentionMode === "manual"
              ? `Per-phase retainage · total retained ${money(d.totalHeld)}`
              : `Retainage ${payment.retention}% held from each draw · total retained ${money(d.totalHeld)}`
        } · ${d.sumPct === 100 ? "balanced 100%" : `${nf1(d.sumPct)}% allocated`}`,
        gridTemplate: usd
          ? "28px 130px minmax(0,1fr) 48px 168px 150px 168px"
          : "28px 150px minmax(0,1fr) 54px 116px 104px 116px",
        head: [
          { label: "#", align: "left" },
          { label: "Draw phase", align: "left" },
          { label: "Disbursement trigger / milestone", align: "left" },
          { label: "%", align: "right" },
          { label: "Draw amount", align: "right" },
          { label: "Retainage", align: "right" },
          { label: "Net release", align: "right" },
        ],
        rows,
        foot: [
          { v: "", align: "left" },
          { v: "Total disbursement", align: "left", bold: true },
          { v: "", align: "left" },
          { v: `${nf1(d.sumPct)}%`, align: "right", bold: true },
          { v: money(d.totalAmount), align: "right", bold: true },
          { v: money(d.totalHeld), align: "right" },
          { v: money(d.totalNet), align: "right", bold: true },
        ],
        titleH, metaH, headH, rowH, footH,
      },
    });
  }

  return blocks;
}

export function EstimatePrintDoc(props: EstimatePrintDocProps) {
  const { est, paper, orient, textSize, pc, showProgress, debug, onPages } = props;

  const { pages, context, columns, gridTemplate, pageSettings, headerTopH, logoH, colHeadRowH, coverMemo } = useMemo(() => {
    const profile = getTextSizeProfile(textSize);
    const pageSettings = buildPageSettings(paper, orient, textSize);
    // Size the header so the enlarged logo can't overlap the column headers:
    // reserve a top region at least as tall as the logo, then the column-header row
    // and body sit below it. printableHeight is derived from this taller header.
    const logoH = pc.logo ? Math.round(46 * 1.2375 * (props.logoScale ?? 1)) : 0;
    const headTextH = Math.round(profile.titleHeight + profile.lineHeight); // project name + meta
    const colHeadRowH = Math.round(profile.lineHeight + profile.verticalPadding);
    const headerTopH = Math.max(headTextH, logoH) + 2;
    pageSettings.headerHeight = headerTopH + 3 + colHeadRowH;
    const { printableHeight, printableWidth } = calculatePrintableArea(pageSettings);
    const context: LayoutContext = {
      textSize,
      profile,
      pageSettings,
      printableHeight,
      printableWidth,
      showPageBreakDebug: debug,
    };
    const columns = buildColumns(pc, showProgress, !!pc && !!props.usdSecondary);
    const { reportData, columnWidths } = buildReportData(props, columns, printableWidth);
    // The recap (Direct Cost + Profit + BBO + Grand Total) ALWAYS prints FIRST, on its
    // own page. The detailed Direct Cost breakdown then follows on later pages WITHOUT
    // these lines.
    if (props.grandTotalRows.length) {
      const rateBlock: MeasuredBlock = {
        id: "recap-rate",
        type: "notes",
        height: profile.lineHeight + profile.verticalPadding * 2,
        keepTogether: true,
        data: { notes: `Average Labor Rate: ${est.currency} ${props.nf0(props.rate)} / hr` },
      };
      const recapTitle: MeasuredBlock = {
        id: "recap-title",
        type: "sheetTitle",
        height: profile.titleHeight,
        keepTogether: true,
        data: { title: "Cost Summary" },
      };
      const recap = measureGrandTotalBlock(
        { rows: props.grandTotalRows, notes: props.notes },
        context,
        columnWidths,
      );
      recap.id = "recap";
      reportData.leadBlocks = [rateBlock, recapTitle, recap];
      // Cost-breakdown chart on the cover page (under the Cost Summary).
      if (pc.chart && props.chartData && props.chartData.length) {
        const total = props.chartData.reduce((s, d) => s + d.value, 0) || 1;
        const segments = props.chartData.map((d) => ({
          label: d.label,
          color: d.color,
          frac: d.value / total, // exact, for pie angles (rounded pct would leave gaps)
          pct: d.pctOverride ?? Math.round((d.value / total) * 100),
          amount: d.amount ?? `${est.currency} ${props.nf0(d.value)}`,
        }));
        const chartTitleH = profile.titleHeight;
        const barRowH = profile.lineHeight + 8;
        const pieD = 152;
        const chartsRowH = Math.max(pieD, segments.length * barRowH);
        reportData.leadBlocks.push({
          id: "chart",
          type: "chart",
          keepTogether: true,
          height: chartTitleH + 8 + chartsRowH + profile.verticalPadding * 2,
          data: { title: "Cost Breakdown", segments, chartTitleH, barRowH, pieD },
        });
      }
      // The detailed breakdown starts on a fresh page after the recap page.
      if (reportData.categories.length) {
        reportData.categories[0] = { ...reportData.categories[0], pageBreakBefore: true };
      }
    }
    // Memo / Remark — pinned to the BOTTOM of the cover page (page 1), ~20px above the
    // footer. Computed here (not a flowing block) so it always hugs the bottom.
    let coverMemo: { text: string; height: number } | null = null;
    if (pc.memo && props.memo && props.memo.trim()) {
      const memoTextH = calculateTextHeight(props.memo, printableWidth, profile);
      coverMemo = {
        text: props.memo,
        height: profile.subcategoryHeaderHeight + memoTextH + profile.verticalPadding * 3 + 8,
      };
    }
    // The Cost Summary recap ALSO prints at the end of the estimation (reportData.grandTotal
    // is left set by buildReportData), so it appears both up front and as the conclusion.
    reportData.extraBlocks = buildAppendixBlocks(props, profile);
    const pages = simulateReportPages(reportData, context, columnWidths);
    const gridTemplate = columns
      .map((c) => (c.flexible ? "minmax(0,1fr)" : `${c.width}px`))
      .join(" ");
    return { pages, context, columns, gridTemplate, pageSettings, headerTopH, logoH, colHeadRowH, coverMemo };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [est, paper, orient, textSize, pc, showProgress, debug, props.grandTotalRows, props.rate, props.notes, props.generalConditions, props.gcActive, props.schedule, props.payment, props.memo, props.logoScale, props.chartData, props.importedAmount]);

  // Validate (loud, never silent) + report page count to the parent (incl. the cover).
  useEffect(() => {
    validatePagination(pages, context);
    onPages?.(pages.length + (props.coverPage ? 1 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, props.coverPage]);

  const { profile } = context;
  // A cover page is prepended to the engine's pages, so every downstream page number
  // shifts by one and the total grows by one.
  const showCover = !!props.coverPage;
  const coverOffset = showCover ? 1 : 0;
  const totalPages = pages.length + coverOffset;

  return (
    <div className="epd-root">
      <style>{`
        .epd-page { position: relative; background: #fff; box-sizing: border-box; overflow: hidden; margin: 0 auto; }
        .epd-page + .epd-page { margin-top: 16px; }
        @media print { .epd-page + .epd-page { margin-top: 0; } .epd-page { break-after: page; } .epd-page:last-child { break-after: auto; } }
        .epd-grid { display: grid; align-items: center; }
        .epd-cell { padding: 0 6px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .epd-cell.desc { white-space: normal; }
        .epd-cat { display: flex; align-items: center; gap: 8px; background: #e2e8f0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; padding: 0 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .03em; color: #0f172a; }
        .epd-sub { background: #f1f5f9; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; }
        .epd-colhead { background: #1e293b; color: #fff; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; }
        .epd-gt { display: flex; align-items: center; justify-content: space-between; padding: 0 8px; }
        .epd-gt.em { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-weight: 800; }
        .epd-dbg-line { position: absolute; left: 0; right: 0; border-top: 1px dashed #ef4444; }
        .epd-dbg-tag { position: absolute; right: 2px; font-size: 8px; color: #ef4444; background: #fff; padding: 0 2px; }
        .epd-cont { font-size: .8em; font-style: italic; color: #475569; text-transform: none; letter-spacing: 0; }
      `}</style>

      {showCover ? (
        <CoverPage
          pageSettings={pageSettings}
          profile={profile}
          est={est}
          image={props.coverImage ?? null}
          logoDataUrl={props.logoDataUrl}
          totalDisplay={props.coverTotalDisplay ?? `${est.currency} ${props.nf0(0)}`}
          footerText={props.footerText}
          footerFontFamily={props.footerFontFamily}
          footerFontSize={props.footerFontSize}
          pageNum={pc.pageNum}
          totalPages={totalPages}
        />
      ) : null}

      {pages.map((page) => (
        <div
          key={page.pageNumber}
          className="epd-page"
          style={{
            width: pageSettings.pageWidth,
            height: pageSettings.pageHeight,
            paddingTop: pageSettings.marginTop,
            paddingBottom: pageSettings.marginBottom,
            paddingLeft: pageSettings.marginLeft,
            paddingRight: pageSettings.marginRight,
            fontSize: profile.fontSize,
            lineHeight: `${profile.lineHeight}px`,
            color: "#0f172a",
          }}
        >
          {/* Running header — repeated on every page. The logo is right-aligned to the
              right margin line (right: 0 sits at pageWidth − marginRight). */}
          <div style={{ height: pageSettings.headerHeight, position: "relative" }}>
            {pc.logo ? (
              <div style={{ position: "absolute", top: 0, right: 0, display: "flex", justifyContent: "flex-end", alignItems: "flex-start" }}>
                {props.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL, arbitrary size, print context
                  <img
                    src={props.logoDataUrl}
                    alt=""
                    style={{
                      height: logoH,
                      maxWidth: 360 * 1.2375 * (props.logoScale ?? 1),
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                ) : (
                  <EstimateLogo size={logoH} />
                )}
              </div>
            ) : null}
            {/* Project title + meta — reserves a top region at least as tall as the logo,
                so the column headers and the body sit below it (no overlap). A thin dotted
                rule under this masthead mirrors the footer rule (sits right under the logo). */}
            <div style={{ height: headerTopH, borderBottom: "0.5px dotted #64748b" }}>
              <div style={{ fontWeight: 700, fontSize: profile.fontSize + 2 }}>
                {est.projectName}
                {page.pageNumber > 1 ? <span className="epd-cont"> (continued)</span> : null}
              </div>
              <div style={{ color: "#64748b", fontSize: profile.fontSize - 1 }}>
                No. {est.projectNumber ?? est.projectId ?? "—"} · {est.location} · Ver {est.version} · {est.date}
              </div>
            </div>
            {page.blocks.some((b) => b.type === "category" || b.type === "itemRow" || b.type === "subtotal") ? (
              <div
                className="epd-grid epd-colhead"
                style={{
                  gridTemplateColumns: gridTemplate,
                  height: colHeadRowH,
                  marginTop: 3,
                  fontSize: profile.fontSize - 1,
                }}
              >
                {columns.map((c) => (
                  <div key={c.key} className="epd-cell" style={{ textAlign: c.align }}>
                    {c.label}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Page body — blocks positioned at their measured Y */}
          <div style={{ position: "relative", height: context.printableHeight }}>
            {page.blocks.map((block) => (
              <BlockView
                key={block.id}
                block={block}
                columns={columns}
                gridTemplate={gridTemplate}
                profile={profile}
                debug={debug}
                zebra={pc.zebra}
                rowSubtotal={pc.rowSubtotal}
              />
            ))}

            {/* Memo / Remark — pinned to the bottom of the cover page, 40px above the footer. */}
            {coverMemo && page.pageNumber === 1 ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: context.printableHeight - 40 - coverMemo.height,
                  height: coverMemo.height,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: profile.fontSize, color: "#0f172a", marginBottom: 3 }}>
                  Memo / Remark
                </div>
                <div
                  style={{
                    flex: 1,
                    color: "#334155",
                    whiteSpace: "pre-wrap",
                    border: "1px solid #cbd5e1",
                    borderRadius: 4,
                    padding: "5px 7px",
                    background: "#f8fafc",
                  }}
                >
                  {coverMemo.text}
                </div>
              </div>
            ) : null}

            {/* Debug overlay: page-safe boundary + remaining height */}
            {debug ? (
              <>
                <div
                  className="epd-dbg-line"
                  style={{ top: context.printableHeight - PAGE_BREAK_SAFETY_BUFFER }}
                />
                <div
                  className="epd-dbg-tag"
                  style={{ top: context.printableHeight - PAGE_BREAK_SAFETY_BUFFER - 10 }}
                >
                  safe · remaining {Math.round(page.remainingHeight)}px
                </div>
              </>
            ) : null}
          </div>

          {/* Footer — page number, with a thin dark-gray dotted rule above it. */}
          <div
            style={{
              height: pageSettings.footerHeight,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#94a3b8",
              fontSize: profile.fontSize - 2,
              borderTop: "0.5px dotted #64748b",
              paddingTop: 3,
            }}
          >
            <span style={{ fontFamily: props.footerFontFamily || undefined, fontSize: props.footerFontSize || undefined }}>
              {props.footerText ?? "AEC Management Suite"}
            </span>
            {pc.pageNum ? (
              <span>
                Page {page.pageNumber + coverOffset} of {totalPages}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The optional Cover Page — page 1 when Print Control → Cover Page is on. A rendering (if
 * uploaded) fills the upper two-thirds; below it, the project name and a facts grid:
 * Client, Project No., Location, Area, Total Cost. Same page geometry and footer as the
 * rest of the document, so it prints and paginates identically.
 */
function CoverPage({
  pageSettings,
  profile,
  est,
  image,
  logoDataUrl,
  totalDisplay,
  footerText,
  footerFontFamily,
  footerFontSize,
  pageNum,
  totalPages,
}: {
  pageSettings: PageSettings;
  profile: ReturnType<typeof getTextSizeProfile>;
  est: CostEstimate;
  image: string | null;
  logoDataUrl?: string | null;
  totalDisplay: string;
  footerText?: string;
  footerFontFamily?: string;
  footerFontSize?: number;
  pageNum: boolean;
  totalPages: number;
}) {
  const facts: { label: string; value: string }[] = [
    { label: "Client", value: est.client?.trim() || "—" },
    { label: "Project No.", value: est.projectNumber ?? est.projectId ?? "—" },
    { label: "Location", value: est.location?.trim() || "—" },
    { label: "Area", value: est.gfa ? `${est.gfa.toLocaleString()} m²` : "—" },
  ];
  const logoH = Math.round(46 * 1.2);

  return (
    <div
      className="epd-page"
      style={{
        width: pageSettings.pageWidth,
        height: pageSettings.pageHeight,
        paddingTop: pageSettings.marginTop,
        paddingBottom: pageSettings.marginBottom,
        paddingLeft: pageSettings.marginLeft,
        paddingRight: pageSettings.marginRight,
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Masthead — logo right, "Cost Estimate" label left. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "0.5px dotted #64748b", paddingBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
          Cost Estimate
        </div>
        {logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, print context
          <img src={logoDataUrl} alt="" style={{ height: logoH, maxWidth: 300, objectFit: "contain", display: "block" }} />
        ) : (
          <EstimateLogo size={logoH} />
        )}
      </div>

      {/* Hero image / rendering — the visual anchor. Placeholder frame when none uploaded. */}
      <div style={{ flex: "1 1 auto", minHeight: 0, marginTop: 18, marginBottom: 18 }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, print context
          <img
            src={image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0", display: "block" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", borderRadius: 6, border: "1px dashed #cbd5e1", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
            Project image / rendering
          </div>
        )}
      </div>

      {/* Project name. */}
      <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: "#0f172a" }}>
        {est.projectName}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: "#64748b" }}>
        Version {est.version}
        {est.date ? ` · ${est.date}` : ""}
      </div>

      {/* Facts grid + the total, banded to stand out. */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 32px" }}>
        {facts.map((f) => (
          <div key={f.label} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>{f.label}</div>
            <div style={{ marginTop: 2, fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{f.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 6, background: "#0f172a", color: "#fff", padding: "12px 16px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>Total Project Cost</span>
        <span style={{ fontSize: 20, fontWeight: 800 }}>{totalDisplay}</span>
      </div>

      {/* Footer — matches the running footer on the rest of the document. */}
      <div
        style={{
          marginTop: 14,
          height: pageSettings.footerHeight,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#94a3b8",
          fontSize: profile.fontSize - 2,
          borderTop: "0.5px dotted #64748b",
          paddingTop: 3,
        }}
      >
        <span style={{ fontFamily: footerFontFamily || undefined, fontSize: footerFontSize || undefined }}>
          {footerText ?? "AEC Management Suite"}
        </span>
        {pageNum ? <span>Page 1 of {totalPages}</span> : <span />}
      </div>
    </div>
  );
}

function BlockView({
  block,
  columns,
  gridTemplate,
  profile,
  debug,
  zebra,
  rowSubtotal,
}: {
  block: MeasuredBlock;
  columns: ColDef[];
  gridTemplate: string;
  profile: ReturnType<typeof getTextSizeProfile>;
  debug?: boolean;
  zebra?: boolean;
  rowSubtotal?: boolean;
}) {
  const common: React.CSSProperties = {
    position: "absolute",
    top: block.y ?? 0,
    left: 0,
    right: 0,
    height: block.height,
  };
  const dbgTag = debug ? (
    <div className="epd-dbg-tag" style={{ top: 0 }}>
      {block.type} {Math.round(block.height)}px
    </div>
  ) : null;

  if (block.type === "category") {
    const code = block.data?.code as string | undefined;
    const name = block.continued ? block.label : block.data?.name;
    const showSub = rowSubtotal && !block.continued && block.data?.subtotalDisplay;
    if (showSub) {
      const iTotal = columns.findIndex((c) => c.key === "total");
      const showPct = iTotal >= 2 && block.data?.sharePctDisplay;
      const nameSpan = Math.max(1, showPct ? iTotal - 1 : iTotal);
      const bandStyle: React.CSSProperties = {
        ...common,
        gridTemplateColumns: gridTemplate,
        background: "#e2e8f0",
        borderTop: "1px solid #cbd5e1",
        borderBottom: "1px solid #cbd5e1",
        textTransform: "uppercase",
        letterSpacing: ".03em",
        color: "#0f172a",
        fontWeight: 700,
      };
      return (
        <div className="epd-grid" style={bandStyle}>
          <div
            className="epd-cell"
            style={{ gridColumn: `1 / span ${nameSpan}`, display: "flex", alignItems: "center", gap: 8 }}
          >
            {code ? <span style={{ fontFamily: "monospace" }}>{code}</span> : null}
            <span>{name}</span>
          </div>
          {showPct ? (
            <div className="epd-cell" style={{ gridColumn: `${iTotal} / span 1`, textAlign: "right" }}>
              {block.data.sharePctDisplay}
            </div>
          ) : null}
          <div
            className="epd-cell"
            style={{ gridColumn: `${iTotal + 1} / span 1`, textAlign: "right", fontWeight: 800 }}
          >
            {block.data.subtotalDisplay}
          </div>
          {dbgTag}
        </div>
      );
    }
    return (
      <div style={common} className="epd-cat">
        {code ? <span style={{ fontFamily: "monospace" }}>{code}</span> : null}
        <span>{name}</span>
        {dbgTag}
      </div>
    );
  }

  if (block.type === "subcategory") {
    return (
      <div style={{ ...common, paddingLeft: 16 }} className="epd-cat">
        <span>{block.continued ? block.label : block.data?.name}</span>
        {dbgTag}
      </div>
    );
  }

  if (block.type === "itemRow") {
    const v = (block.data?.values ?? {}) as Record<string, string>;
    const banded = zebra && block.data?.zebra;
    return (
      <div
        className="epd-grid"
        style={{
          ...common,
          gridTemplateColumns: gridTemplate,
          background: banded ? ZEBRA_FILL : undefined,
        }}
      >
        {columns.map((c) => {
          if (c.key === "desc") {
            return (
              <div key={c.key} className="epd-cell desc" style={{ textAlign: c.align }}>
                {block.data?.description}
                {block.data?.note ? (
                  <div style={{ color: "#64748b", fontSize: profile.fontSize - 1 }}>{block.data.note}</div>
                ) : null}
              </div>
            );
          }
          if (c.key === "code") {
            return (
              <div key={c.key} className="epd-cell" style={{ textAlign: c.align, fontFamily: "monospace", color: "#64748b" }}>
                {block.data?.code ?? ""}
              </div>
            );
          }
          return (
            <div key={c.key} className="epd-cell" style={{ textAlign: c.align }}>
              {v[c.key] ?? ""}
            </div>
          );
        })}
        {dbgTag}
      </div>
    );
  }

  if (block.type === "subtotal") {
    const v = (block.data?.values ?? {}) as Record<string, string>;
    return (
      <div className="epd-grid epd-sub" style={{ ...common, gridTemplateColumns: gridTemplate }}>
        {columns.map((c, i) => {
          if (i === 0) {
            // Span the label across the leading code+desc(+qty/unit) columns.
            return (
              <div key={c.key} className="epd-cell" style={{ gridColumn: `1 / span ${leadingSpan(columns)}`, textAlign: "right", fontWeight: 700 }}>
                {block.data?.label}
              </div>
            );
          }
          if (i < leadingSpan(columns)) return null;
          return (
            <div key={c.key} className="epd-cell" style={{ textAlign: c.align }}>
              {v[c.key] ?? ""}
            </div>
          );
        })}
        {dbgTag}
      </div>
    );
  }

  if (block.type === "grandTotal") {
    const rows = (block.data?.rows ?? []) as GrandTotalRow[];
    return (
      <div style={common}>
        {block.data?.title ? (
          <div style={{ height: profile.titleHeight, display: "flex", alignItems: "center", fontWeight: 800, fontSize: profile.fontSize + 3, color: "#0f172a" }}>
            {block.data.title}
          </div>
        ) : null}
        {rows.map((r, i) => (
          <div
            key={i}
            className={`epd-gt ${r.emphasize ? "em" : ""}`}
            style={{ height: r.emphasize ? profile.totalRowHeight : profile.subtotalRowHeight }}
          >
            <span style={{ textTransform: "uppercase", letterSpacing: ".03em" }}>{r.label}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.value}</span>
          </div>
        ))}
        {block.data?.notes ? (
          <div style={{ color: "#64748b", fontSize: profile.fontSize - 1, paddingTop: 4 }}>{block.data.notes}</div>
        ) : null}
        {dbgTag}
      </div>
    );
  }

  if (block.type === "reportTitle" || block.type === "sheetTitle") {
    return (
      <div style={{ ...common, display: "flex", alignItems: "center", fontWeight: 700, fontSize: profile.fontSize + 4 }}>
        {block.data?.title}
        {dbgTag}
      </div>
    );
  }

  if (block.type === "notes") {
    return (
      <div style={{ ...common, display: "flex", flexDirection: "column" }}>
        {block.data?.title ? (
          <div style={{ fontWeight: 700, fontSize: profile.fontSize, color: "#0f172a", marginBottom: 3 }}>
            {block.data.title}
          </div>
        ) : null}
        <div
          style={{
            flex: 1,
            color: "#334155",
            whiteSpace: "pre-wrap",
            ...(block.data?.boxed
              ? { border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 7px", background: "#f8fafc" }
              : {}),
          }}
        >
          {block.data?.notes}
        </div>
        {dbgTag}
      </div>
    );
  }

  if (block.type === "timeline" || block.type === "phaseTable") {
    const d = block.data as {
      title: string;
      meta: string;
      gridTemplate: string;
      head: { label: string; align: "left" | "right" | "center" }[];
      rows: (
        | { v: string; align: "left" | "right" | "center" }
        | { gantt: { start: number; width: number }; label?: string; pct?: string }
      )[][];
      foot: { v: string; align: "left" | "right" | "center"; bold?: boolean }[];
      titleH: number;
      metaH: number;
      headH: number;
      rowH: number;
      footH: number;
    };
    return (
      <div style={{ ...common, display: "flex", flexDirection: "column" }}>
        <div style={{ height: d.titleH, display: "flex", alignItems: "center", fontWeight: 800, fontSize: profile.fontSize + 3, color: "#0f172a" }}>
          {d.title}
        </div>
        <div style={{ height: d.metaH, color: "#64748b", fontSize: profile.fontSize - 1 }}>{d.meta}</div>
        <div className="epd-grid epd-colhead" style={{ gridTemplateColumns: d.gridTemplate, height: d.headH, fontSize: profile.fontSize - 1 }}>
          {d.head.map((h, i) => (
            <div key={i} className="epd-cell" style={{ textAlign: h.align }}>{h.label}</div>
          ))}
        </div>
        {d.rows.map((row, ri) => (
          <div
            key={ri}
            className="epd-grid"
            style={{ gridTemplateColumns: d.gridTemplate, height: d.rowH, background: ri % 2 === 1 ? ZEBRA_FILL : undefined, borderBottom: "1px solid #e5e7eb" }}
          >
            {row.map((c, ci) =>
              "gantt" in c ? (
                <div key={ci} className="epd-cell" style={{ display: "flex", alignItems: "center" }} title={c.label}>
                  <div style={{ position: "relative", width: "100%", height: Math.max(11, d.rowH - 3), borderRadius: 2, background: "#e5edf7" }}>
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${Math.max(0, Math.min(100, c.gantt.start))}%`,
                        width: `${Math.max(1.5, Math.min(100, c.gantt.width))}%`,
                        background: "#3b82f6",
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {c.pct && c.gantt.width > 7 ? (
                        <span style={{ color: "#fff", fontSize: profile.fontSize - 3, fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}>{c.pct}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={ci} className="epd-cell" style={{ textAlign: c.align }}>{c.v}</div>
              ),
            )}
          </div>
        ))}
        <div className="epd-grid" style={{ gridTemplateColumns: d.gridTemplate, height: d.footH, borderTop: "2px solid #0f172a", fontWeight: 700 }}>
          {d.foot.map((c, ci) => (
            <div key={ci} className="epd-cell" style={{ textAlign: c.align, fontWeight: c.bold ? 800 : 600 }}>{c.v}</div>
          ))}
        </div>
        {dbgTag}
      </div>
    );
  }

  if (block.type === "chart") {
    const d = block.data as {
      title: string;
      segments: { label: string; color: string; frac: number; pct: number; amount: string }[];
      chartTitleH: number;
      barRowH: number;
      pieD: number;
    };
    const segs = d.segments;
    const r = d.pieD / 2 - 1;
    const cx = d.pieD / 2;
    const cy = d.pieD / 2;
    const single = segs.length === 1;
    // Pie slice paths from EXACT fractions, starting at 12 o'clock.
    let a0 = -Math.PI / 2;
    const slices = segs.map((s) => {
      const a1 = a0 + s.frac * Math.PI * 2;
      const x1 = cx + r * Math.cos(a0);
      const y1 = cy + r * Math.sin(a0);
      const x2 = cx + r * Math.cos(a1);
      const y2 = cy + r * Math.sin(a1);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      // % label at the slice mid-angle, ~62% out from centre.
      const mid = (a0 + a1) / 2;
      const lx = cx + r * 0.62 * Math.cos(mid);
      const ly = cy + r * 0.62 * Math.sin(mid);
      a0 = a1;
      return { path, color: s.color, lx, ly, pct: s.pct };
    });
    return (
      <div style={{ ...common, display: "flex", flexDirection: "column" }}>
        <div style={{ height: d.chartTitleH, display: "flex", alignItems: "center", fontWeight: 800, fontSize: profile.fontSize + 3, color: "#0f172a" }}>
          {d.title}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 8, alignItems: "center" }}>
          {/* Pie chart */}
          <svg width={d.pieD} height={d.pieD} viewBox={`0 0 ${d.pieD} ${d.pieD}`} style={{ flexShrink: 0 }} aria-hidden>
            {single ? (
              <>
                <circle cx={cx} cy={cy} r={r} fill={segs[0].color} />
                <text x={cx} y={cy} fill="#ffffff" fontSize={profile.fontSize} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                  {segs[0].pct}%
                </text>
              </>
            ) : (
              <>
                {slices.map((sl, i) => (
                  <path key={i} d={sl.path} fill={sl.color} stroke="#ffffff" strokeWidth="1" />
                ))}
                {slices.map((sl, i) =>
                  sl.pct >= 5 ? (
                    <text key={`t${i}`} x={sl.lx.toFixed(1)} y={sl.ly.toFixed(1)} fill="#ffffff" fontSize={profile.fontSize - 2} fontWeight={700} textAnchor="middle" dominantBaseline="central">
                      {sl.pct}%
                    </text>
                  ) : null,
                )}
              </>
            )}
          </svg>
          {/* Bar chart (one bar per component) + values */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
            {segs.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, height: d.barRowH }}>
                <span style={{ width: 96, color: "#334155", fontSize: profile.fontSize - 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</span>
                <div style={{ flex: 1, height: Math.max(8, d.barRowH - 6), background: "#eef2f7", borderRadius: 2, position: "relative" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${s.pct}%`, background: s.color, borderRadius: 2 }} />
                </div>
                <span style={{ width: 34, textAlign: "right", fontWeight: 700, fontSize: profile.fontSize - 1, color: "#0f172a" }}>{s.pct}%</span>
                <span style={{ width: 112, textAlign: "right", fontSize: profile.fontSize - 1, color: "#334155", fontVariantNumeric: "tabular-nums" }}>{s.amount}</span>
              </div>
            ))}
          </div>
        </div>
        {dbgTag}
      </div>
    );
  }

  return (
    <div style={common}>
      {dbgTag}
    </div>
  );
}

/** Number of leading columns the subtotal label spans (code+desc, plus qty/unit if shown). */
function leadingSpan(columns: ColDef[]): number {
  let span = 0;
  for (const c of columns) {
    if (c.key === "code" || c.key === "desc" || c.key === "qty" || c.key === "unit") span++;
    else break;
  }
  return Math.max(2, span);
}
