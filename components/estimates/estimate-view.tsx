"use client";

import { useState, useRef, useEffect, useLayoutEffect, Fragment } from "react";
import { Plus, Trash2, Save, Printer, Check, Eye, X, FileDown, ChevronUp, ChevronDown, ChevronRight, MoreHorizontal, Database, ImagePlus, Bug } from "lucide-react";
import { EstimatePrintDoc, type PrintControl } from "./estimate-print-doc";
import type { GrandTotalRow } from "@/lib/estimates/pagination-engine";
import { computeSections, type ScheduleConfig, type PaymentConfig } from "@/lib/estimates/budget-timeline";
import { CostSummaryCharts } from "./cost-summary-charts";
import type { FooterSettings } from "@/lib/server/practice-config";
import { Card } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { firmName } from "@/lib/firm-identity";
import { SectionCopy } from "./section-copy";
import {
  ESTIMATE_UNITS,
  type CostEstimate,
  type EstimateCategory,
  type EstimateItem,
  type CalculationMethod,
  type AssemblyComponent,
  type AssemblyComponentType,
  type TakeoffRow,
} from "@/lib/data/estimates.types";
import {
  normTrades,
  type EstimateTemplate,
  type NormSetTask,
} from "@/lib/data/estimate-presets";
import type { PriceItem } from "@/lib/data/price-lists.types";
import {
  COST_SOURCES,
  COST_ITEMS,
  COST_INDEXES,
  REGIONAL_ADJUSTMENTS,
  REGION_TARGETS,
} from "@/lib/data/cost-data/seed";
import { indexedCost, adjustedCost, factorsFor } from "@/lib/data/cost-data/engines";
import { sumGeneralConditions, type GeneralConditionItem } from "@/lib/data/general-conditions";
import { calcItem, sum, ZERO, pocPct, type Totals } from "@/lib/estimates/calc";
import { saveEstimateAction, saveTemplatesAction } from "@/app/(app)/estimates/actions";

const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");
const nf2 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// Estimation Print Template — a saved bundle of print settings, kept in localStorage.
const PRINT_TEMPLATES_KEY = "aec.estimate.print-templates";
// Per-estimate local backup of unsaved work (belt-and-suspenders against data loss).
const ESTIMATE_DRAFT_PREFIX = "aec.estimate.draft.";
type PrintTemplate = {
  printSize: "normal" | "medium" | "small";
  paper: "A4" | "A3";
  orient: "landscape" | "portrait";
  pc: PrintControl;
  logoScale?: number;
};

// Shared dense field height — drives row height (overrides the taller browser default on <input>/<select>).
const FIELD_H = "h-4"; // 16px
const cellInput =
  `w-full rounded bg-transparent px-1 py-0 ${FIELD_H} text-right text-[11px] leading-none tabular-nums text-fg outline-none focus:bg-brand/5 focus:ring-1 focus:ring-brand/30`;
const calcCls = "px-1 py-0 text-right text-[11px] leading-none tabular-nums text-fg";
// Group boundary vertical: thin (1px) + 20% darker than the old slate-300.
const grpDiv = "border-l border-border";
// Internal sub-column divider: thin dotted black (Norm hrs/u · Total Hrs · Labor Cost, and each group's Total).
const subDiv = "border-l border-dotted border-black/40";

type EstimateViewProps = {
  est: CostEstimate;
  setEst: React.Dispatch<React.SetStateAction<CostEstimate>>;
  templates: EstimateTemplate[];
  setTemplates: React.Dispatch<React.SetStateAction<EstimateTemplate[]>>;
  activeTemplate: string | null;
  setActiveTemplate: (name: string | null) => void;
  normSet: NormSetTask[];
  generalConditions: GeneralConditionItem[];
  /** General Conditions / Overhead active flag — lifted to the workspace so the Budget
   * disbursement tab and the print doc share the same Total Development Cost buildup. */
  gcActive: boolean;
  setGcActive: (v: boolean) => void;
  materials: PriceItem[];
  equipment: PriceItem[];
  schedule: ScheduleConfig;
  payment: PaymentConfig;
  /** The WHOLE `budget` JSON, built once by the workspace. This sheet's autosave replaces
   * that column wholesale, so it must write every key — building it here (as this used to)
   * is how take-off and fx each got silently erased in turn. */
  budget: CostEstimate["budget"];
  /** Take-Off measurements — not rendered here; kept for the local backup snapshot. */
  takeoff: TakeoffRow[];
  takeoffSection: string;
  /** USD secondary unit — lifted to the workspace so it persists in the `budget` JSON. */
  usdSecondary: boolean;
  setUsdSecondary: (v: boolean) => void;
  usdRate: number;
  setUsdRate: (v: number) => void;
  /** Cover page — toggle + the project image/rendering (data URL). Persisted per-estimate. */
  coverOn: boolean;
  setCoverOn: (v: boolean) => void;
  coverImage: string | null;
  setCoverImage: (v: string | null) => void;
  logoDataUrl?: string | null;
  footer?: FooterSettings;
  newId: (p: string) => string;
  /** Preview/print overlay is controlled by the parent so the workspace "Export"
   * button opens the SAME EstimatePrintDoc — one renderer, so preview == print. */
  preview: boolean;
  setPreview: (v: boolean) => void;
};

export function EstimateView({ est, setEst, templates, setTemplates, activeTemplate, setActiveTemplate, normSet, generalConditions, gcActive, setGcActive, materials, equipment, schedule, payment, budget, takeoff, takeoffSection, usdSecondary, setUsdSecondary, usdRate, setUsdRate, coverOn, setCoverOn, coverImage, setCoverImage, logoDataUrl, footer, newId, preview, setPreview }: EstimateViewProps) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const draftKey = est.id ? ESTIMATE_DRAFT_PREFIX + est.id : null;
  // On mount, surface a local backup of unsaved work from a previous session
  // (e.g. a crash/refresh before the server save landed). Captured in memory now,
  // before the backup effect below overwrites the stored copy.
  const [pendingDraft, setPendingDraft] = useState<{ est: CostEstimate; schedule: ScheduleConfig; payment: PaymentConfig; ts: number } | null>(() => {
    if (typeof window === "undefined" || !est.id) return null;
    try {
      const raw = window.localStorage.getItem(ESTIMATE_DRAFT_PREFIX + est.id);
      if (!raw) return null;
      const d = JSON.parse(raw);
      // Only offer it if it actually differs from what we just loaded.
      if (d?.est && JSON.stringify(d.est.categories) !== JSON.stringify(est.categories)) return d;
      return null;
    } catch {
      return null;
    }
  });
  const trades = normTrades(normSet);
  const normById = (id: string) => normSet.find((n) => n.id === id);
  const codeOfTask = (task: string) => normSet.find((n) => n.task.toLowerCase() === task.toLowerCase())?.code ?? "";
  const [showProgress, setShowProgress] = useState(true);
  const [clientVersion, setClientVersion] = useState(false);
  const [paper, setPaper] = useState<"A4" | "A3">("A3");
  const [orient, setOrient] = useState<"landscape" | "portrait">("landscape");
  const [pvZoom, setPvZoom] = useState(0.65);
  // Print text density: Small packs the most rows per page, Normal is the most legible.
  const [printSize, setPrintSize] = useState<"normal" | "medium" | "small">("medium");
  // Smart Page-Break Engine: computed page count + optional visual debug overlay.
  const [enginePages, setEnginePages] = useState(1);
  const [pcDebug, setPcDebug] = useState(false);
  // Collapsed sections (editor view only — Print Control has its own list, so what you
  // fold away on screen doesn't silently change what the client receives).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const isCollapsed = (id: string) => collapsed.has(id);
  const toggleCollapse = (id: string) =>
    setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const collapseAll = () => setCollapsed(new Set(est.categories.map((c) => c.id)));
  const expandAll = () => setCollapsed(new Set());

  // Assembly-Based line items: which rows have their component editor expanded.
  const [openAsm, setOpenAsm] = useState<Set<string>>(new Set());
  const toggleAsm = (id: string) =>
    setOpenAsm((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Estimation Print Templates (saved print-setting bundles).
  const [printTemplates, setPrintTemplates] = useState<Record<string, PrintTemplate>>({});
  const [activePrintTemplate, setActivePrintTemplate] = useState<string>("");
  // Free-text Memo / Remark printed on the cover page under the Cost Summary.
  const [memo, setMemo] = useState("");
  // Print logo scale (1 = default); aligned to the right margin on every page.
  const [logoScale, setLogoScale] = useState(1);
  // Print Control — what gets included in the printed / previewed sheet (live edit grid is unaffected).
  const [pcOpen, setPcOpen] = useState(false);
  const [pc, setPc] = useState({
    labor: true,
    material: true,
    equipment: true,
    subcontractor: true,
    qtyUnit: true,
    pageNum: true,
    generalConditions: false, // GC detail page is opt-in: only previewed/printed when selected
    zebra: true,
    rowSubtotal: true,
    logo: true,
    timeline: false,
    phaseDisbursement: false,
    memo: false,
    chart: false,
    importedMaterials: false, // break out Imported Materials, Equipment & Logistics
    methodDetail: false, // annotate each line with its calculation method (default OFF)
    // Rate columns — the per-unit inputs behind each cost. OFF by default: they widen
    // the sheet, and most clients only want the resulting costs.
    laborNorm: false,
    laborHrs: false,
    materialUnit: false,
    equipmentUnit: false,
    subUnit: false,
    // Section ids that print as header + subtotal only.
    collapsedSections: [] as string[],
  });
  const [pcCollapseOpen, setPcCollapseOpen] = useState(false);
  const printCollapsed = pc.collapsedSections ?? [];
  // Overflow menu (occasional actions) + the Cost Database popover.
  const [moreOpen, setMoreOpen] = useState(false);
  const [costDbOpen, setCostDbOpen] = useState(false);

  // Cover-image upload. Renderings can be large; a multi-MB data URL bloats every save of
  // the `budget` JSON and slows the sheet. So we downscale to <=1600px on the long edge
  // and re-encode as JPEG before storing — plenty for an A4/A3 hero image, a fraction of
  // the bytes. Runs entirely in the browser (canvas), no upload endpoint needed.
  const [coverErr, setCoverErr] = useState<string | null>(null);
  const onCoverFile = (file: File | null) => {
    setCoverErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverErr("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setCoverErr("Could not process this image.");
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setCoverImage(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => setCoverErr("That image couldn't be read.");
      img.src = reader.result as string;
    };
    reader.onerror = () => setCoverErr("That file couldn't be read.");
    reader.readAsDataURL(file);
  };

  // Load saved print templates from localStorage once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PRINT_TEMPLATES_KEY);
      if (raw) setPrintTemplates(JSON.parse(raw));
    } catch {
      /* ignore malformed/unavailable storage */
    }
  }, []);
  const persistPrintTemplates = (t: Record<string, PrintTemplate>) => {
    setPrintTemplates(t);
    try {
      window.localStorage.setItem(PRINT_TEMPLATES_KEY, JSON.stringify(t));
    } catch {
      /* ignore */
    }
  };
  const savePrintTemplate = () => {
    const name = window.prompt("Save these print settings as a template named:", activePrintTemplate || "");
    if (!name) return;
    persistPrintTemplates({ ...printTemplates, [name.trim()]: { printSize, paper, orient, pc, logoScale } });
    setActivePrintTemplate(name.trim());
  };
  const loadPrintTemplate = (name: string) => {
    setActivePrintTemplate(name);
    const t = printTemplates[name];
    if (!t) return;
    setPrintSize(t.printSize);
    setPaper(t.paper);
    setOrient(t.orient);
    setLogoScale(t.logoScale ?? 1);
    // Merge so templates saved before a new toggle existed keep sensible defaults.
    setPc((prev) => ({ ...prev, ...t.pc }));
  };
  const deletePrintTemplate = (name: string) => {
    if (!name) return;
    const next = { ...printTemplates };
    delete next[name];
    persistPrintTemplates(next);
    if (activePrintTemplate === name) setActivePrintTemplate("");
  };

  // Cost Database wiring (free sources): pick a source, optionally index + regionally adjust prices.
  const [costSourceId, setCostSourceId] = useState("src-zenarch");
  const [applyIndex, setApplyIndex] = useState(false);
  const [applyRegional, setApplyRegional] = useState(true);
  const [regionTarget, setRegionTarget] = useState(() => {
    const t = REGION_TARGETS.find((x) => x.region === "Aruba") ?? REGION_TARGETS[0];
    return `${t.country}|${t.region}`;
  });

  const rate = est.avgLaborRate;
  const colCount = 14 + (showProgress ? 2 : 0); // category-header colSpan; +2 when Progress is on
  const clientCols = 6 + (showProgress ? 1 : 0); // Client Version columns: Code·Task + 4 groups + Item Total [+ Progress]
  // Fixed-layout column widths (sum ≈ 100%) so the sheet always fits the screen — no horizontal scroll.
  // Progress ON squeezes columns; OFF relaxes them. Order matches the <colgroup> below.
  // Order: Code·Task, Qty, Unit, Norm, TotalHrs, LaborCost, Mat-Unit, Mat-Total, Eq-Unit, Eq-Total, Sub-Unit, Sub-Total, ItemTotal, [POC, ProgAmt,] action.
  // Material/Equipment/Subcontractor "Unit Cost" columns are kept narrow.
  // Code · Task gets the lion's share — descriptions are what actually get cramped; the
  // numeric columns only need to fit a few digits, so width was trimmed off them.
  const COLW = showProgress
    ? ["34%", "4%", "4%", "4.5%", "4.5%", "5.5%", "4%", "5%", "4%", "5%", "4%", "5%", "5.5%", "4.5%", "4.5%", "2%"]
    : ["38%", "4.5%", "4.5%", "5%", "5%", "6%", "4.5%", "5.5%", "4.5%", "5%", "4.5%", "5%", "6%", "2%"];
  // Print Control column-group tags, positionally aligned with COLW / the <colgroup> below.
  // Order: Code·Task, Qty, Unit, Norm, TotalHrs, LaborCost, Mat-U, Mat-T, Eq-U, Eq-T, Sub-U, Sub-T, ItemTotal, [POC, ProgAmt,] action.
  const colClass = showProgress
    ? ["", "pc-qtyunit", "pc-qtyunit", "pc-labor", "pc-labor", "pc-labor", "pc-material", "pc-material", "pc-equipment", "pc-equipment", "pc-subcontractor", "pc-subcontractor", "", "", "", "no-print"]
    : ["", "pc-qtyunit", "pc-qtyunit", "pc-labor", "pc-labor", "pc-labor", "pc-material", "pc-material", "pc-equipment", "pc-equipment", "pc-subcontractor", "pc-subcontractor", "", "no-print"];

  // Cost Database derived (free sources only).
  const costSources = COST_SOURCES.filter((s) => !s.licenseRequired);
  const cbsValues = COST_INDEXES.filter((ix) => ix.sourceId === "src-cbs").map((i) => i.indexValue);
  const baseIndex = cbsValues.length ? Math.min(...cbsValues) : 100;
  const currentIndex = cbsValues.length ? Math.max(...cbsValues) : 100;
  const costItemsForSource = COST_ITEMS.filter((i) => i.sourceId === costSourceId);
  const costItemRegions = costItemsForSource.reduce<string[]>((a, i) => (a.includes(i.region ?? "—") ? a : [...a, i.region ?? "—"]), []);

  // Print text density → font size (px) + vertical cell padding (px).
  // Small = smallest text/numbers ⇒ most rows per page; Normal = most legible.
  const printFont = printSize === "normal" ? 11 : printSize === "medium" ? 9 : 7.5;
  const printPad = printSize === "small" ? 0 : 1;

  // Page geometry for preview / print.
  const MM = 96 / 25.4;
  const [shortMm, longMm] = paper === "A4" ? [210, 297] : [297, 420];
  const pageWmm = orient === "landscape" ? longMm : shortMm;
  const pageHmm = orient === "landscape" ? shortMm : longMm;
  const contentWpx = Math.round((pageWmm - 14) * MM); // usable width (7mm side margins, matches @page)
  const contentHpx = Math.round((pageHmm - 18) * MM); // usable height (7mm top + 11mm bottom margins)
  const previewMeasureRef = useRef<HTMLDivElement>(null);
  const [bodyH, setBodyH] = useState(0);
  const pages = preview && bodyH > 0 ? Math.max(1, Math.ceil((bodyH - 2) / contentHpx)) : 1;
  // Use the CSS named size + orientation keyword (e.g. "A4 landscape") rather than
  // explicit mm dims — browsers/PDF engines honour the named form reliably and
  // actually rotate the sheet, so landscape no longer prints on a portrait page
  // with the right-hand columns clipped.
  // Print Control: collapse hidden column groups in print AND in the on-screen preview.
  // We display:none the cells and zero the matching <col> so the remaining columns reflow.
  const hideGroup = (cls: string) =>
    `@media print { .${cls} { display: none !important; } col.${cls} { width: 0 !important; } }
     .previewing .${cls} { display: none !important; } .previewing col.${cls} { width: 0 !important; }`;
  const pcHideCss = [
    !pc.labor && hideGroup("pc-labor"),
    !pc.material && hideGroup("pc-material"),
    !pc.equipment && hideGroup("pc-equipment"),
    !pc.subcontractor && hideGroup("pc-subcontractor"),
    !pc.qtyUnit && hideGroup("pc-qtyunit"),
  ].filter(Boolean).join("\n");
  // Page numbering margin boxes are only emitted when Page# is on.
  const pageNumBoxes = pc.pageNum
    ? `  @top-right { content: "Page " counter(page) " of " counter(pages); font-size: 7.5pt; color: #64748b; }
  @bottom-center { content: "P" counter(page) " of " counter(pages); font-size: 7.5pt; color: #64748b; }`
    : "";
  // In Preview we print the Smart Page-Break Engine document, which owns its own
  // page margins, running header and footer — so @page must contribute ZERO margin
  // (otherwise margins double up). Direct (non-preview) printing keeps the classic
  // @page margins + counter() page-number boxes.
  const pageStyle = `${preview
    ? `@page { size: ${paper} ${orient}; margin: 0; }`
    : `@page { size: ${paper} ${orient}; margin: 7mm 7mm 11mm 7mm;
${pageNumBoxes}
  @bottom-left { content: "AEC Management Suite"; font-size: 7pt; color: #94a3b8; }
}`}
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .est-scroll { overflow: visible !important; }
  .est-card { box-shadow: none !important; border: none !important; }
  .screen-scale { zoom: 1 !important; }
  /* Repeat the table header (project block + column headers) on every page. */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  table th, table td { position: static !important; }
  /* Clean page breaks: never split a row — and never split the cells inside it —
     across a page boundary. Chrome honours break-inside on tr unreliably unless the
     cells opt in too, which is what produced the half-cut rows. */
  tr { break-inside: avoid !important; page-break-inside: avoid !important; }
  td, th { break-inside: avoid !important; page-break-inside: avoid !important; }
  /* A section header must never be the last thing on a page (orphan); keep it with
     the rows that follow it. */
  .est-cat-head { break-inside: avoid !important; break-after: avoid-page !important; page-break-after: avoid !important; }
  /* Allow page breaks between a section's rows, but not inside any single row. */
  tbody { break-inside: auto; page-break-inside: auto; }
  /* Keep the end summary (the large footer) together. */
  .print-footer { break-inside: avoid; page-break-inside: avoid; }
  .print-page-head { display: table-row !important; }
  /* Compact print: font + row height scale with the chosen Print Size so more (or fewer) rows fit per page on A4/A3. */
  .est-card table { font-size: ${printFont}px; line-height: 1.1; }
  .est-card table th, .est-card table td { font-size: ${printFont}px !important; padding-top: ${printPad}px !important; padding-bottom: ${printPad}px !important; }
  .est-card table input, .est-card table select { height: auto !important; font-size: ${printFont}px !important; line-height: 1.1 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
  .only-preview { display: none !important; }
  /* When printing from the preview, the sliced page-frames are hidden and this single flow paginates. */
  .print-doc { display: block !important; }
  /* Strip native control chrome so values print as clean, unobstructed text. */
  select { -webkit-appearance: none !important; appearance: none !important; background-image: none !important; }
  input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
/* On-screen Preview overlay: mirror print — hide controls, drop card chrome & native arrows, white page. */
.previewing { background: #fff; }
.previewing .no-print { display: none !important; }
.previewing .est-card { box-shadow: none !important; border-color: transparent !important; }
.previewing select { -webkit-appearance: none !important; appearance: none !important; background-image: none !important; }
.previewing input[type=number]::-webkit-inner-spin-button, .previewing input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
/* Mirror the print Size in the preview so the measured page count matches the printed output. */
.previewing .est-card table { font-size: ${printFont}px; line-height: 1.1; }
.previewing .est-card table th, .previewing .est-card table td { font-size: ${printFont}px !important; padding-top: ${printPad}px !important; padding-bottom: ${printPad}px !important; }
.previewing .est-card table input, .previewing .est-card table select { height: auto !important; font-size: ${printFont}px !important; line-height: 1.1 !important; padding-top: 0 !important; padding-bottom: 0 !important; }
.print-doc { display: none; }
.est-print-guard { display: none; }
${pcHideCss}
${!preview ? `@media print {
  /* Raw Ctrl+P while editing must NOT print the working grid — it isn't the real
     layout. Hide it and point the user at the one true print path (Print / PDF). */
  .est-scroll, .est-card { display: none !important; }
  .est-print-guard { display: block !important; margin: 45mm auto 0; max-width: 150mm; text-align: center; font-size: 15px; line-height: 1.7; color: #111827; }
}` : ""}`;

  // Measure the unzoomed content height so the preview can slice it into real page-sized sheets.
  useEffect(() => {
    if (!preview) return;
    const el = previewMeasureRef.current;
    if (el) setBodyH(el.scrollHeight);
  }, [preview, paper, orient, showProgress, clientVersion, gcActive, est, contentWpx, printSize, pc]);

  const patchMeta = (patch: Partial<CostEstimate>) => {
    setSaved(false);
    setEst((e) => ({ ...e, ...patch }));
  };
  const patchItem = (catId: string, itemId: string, patch: Partial<EstimateItem>) => {
    setSaved(false);
    setEst((e) => ({
      ...e,
      categories: e.categories.map((c) =>
        c.id !== catId ? c : { ...c, items: c.items.map((it) => (it.id !== itemId ? it : { ...it, ...patch })) },
      ),
    }));
  };
  const patchCat = (catId: string, patch: Partial<EstimateCategory>) => {
    setSaved(false);
    setEst((e) => ({ ...e, categories: e.categories.map((c) => (c.id !== catId ? c : { ...c, ...patch })) }));
  };
  const addItem = (catId: string) =>
    patchCatItems(catId, (items) => [
      ...items,
      { id: newId("i"), task: "", qty: 0, unit: "m²", laborNorm: 0, materialUnitCost: 0, equipmentUnitCost: 0, subcontractUnitCost: 0, poc: 0, code: "" },
    ]);
  const removeItem = (catId: string, itemId: string) =>
    patchCatItems(catId, (items) => items.filter((it) => it.id !== itemId));
  // Reorder: move a line item up (-1) or down (+1) within its section.
  const moveItem = (catId: string, itemId: string, dir: -1 | 1) =>
    patchCatItems(catId, (items) => {
      const i = items.findIndex((it) => it.id === itemId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= items.length) return items;
      const next = items.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  // Norm Set List: append a line item pre-filled with a standard task's fixed Norm Hrs/Unit.
  const addItemFromNorm = (catId: string, normId: string) => {
    const n = normById(normId);
    if (!n) return;
    patchCatItems(catId, (items) => [
      ...items,
      {
        id: newId("i"),
        task: n.task,
        code: n.code ?? "",
        qty: 0,
        unit: n.unit,
        laborNorm: n.laborNorm,
        materialUnitCost: n.materialUnitCost ?? 0,
        equipmentUnitCost: n.equipmentUnitCost ?? 0,
        subcontractUnitCost: n.subcontractUnitCost ?? 0,
        poc: 0,
      },
    ]);
  };
  // Insert a Cost Database item as a line, applying indexation + regional adjustment per the toolbar settings.
  const addCostItem = (catId: string, itemId: string) => {
    const ci = COST_ITEMS.find((x) => x.id === itemId);
    if (!ci) return;
    let price = ci.baseCost;
    if (applyIndex) price = indexedCost(price, baseIndex, currentIndex);
    if (applyRegional) {
      const [country, region] = regionTarget.split("|");
      let f = factorsFor(REGIONAL_ADJUSTMENTS, country, region);
      if (ci.currency === est.currency) f = { ...f, currencyConversion: 1 }; // no FX if already in estimate currency
      price = adjustedCost(price, f);
    }
    price = Math.round(price * 100) / 100;
    const t = ci.costType;
    patchCatItems(catId, (items) => [
      ...items,
      {
        id: newId("i"),
        code: ci.classificationCode || ci.externalReferenceCode || "",
        task: ci.title,
        qty: 0,
        unit: ci.unit,
        laborNorm: 0,
        materialUnitCost: t === "material" ? price : 0,
        equipmentUnitCost: t === "equipment" ? price : 0,
        subcontractUnitCost: t === "subcontract" || t === "composite" || t === "index" || t === "labor" ? price : 0,
        poc: 0,
      },
    ]);
  };
  function patchCatItems(catId: string, fn: (items: EstimateItem[]) => EstimateItem[]) {
    setSaved(false);
    setEst((e) => ({ ...e, categories: e.categories.map((c) => (c.id !== catId ? c : { ...c, items: fn(c.items) })) }));
  }
  const addCategory = () => {
    setSaved(false);
    setEst((e) => ({ ...e, categories: [...e.categories, { id: newId("c"), name: "New Section", code: "", items: [] }] }));
  };
  const removeCategory = (catId: string) => {
    setSaved(false);
    setEst((e) => ({ ...e, categories: e.categories.filter((c) => c.id !== catId) }));
  };
  // Reorder whole sections (Foundation, Masonry…) up (-1) or down (+1).
  const moveCategory = (catId: string, dir: -1 | 1) => {
    setSaved(false);
    setEst((e) => {
      const i = e.categories.findIndex((c) => c.id === catId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= e.categories.length) return e;
      const next = e.categories.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return { ...e, categories: next };
    });
  };
  // Template Picker: replace the sheet's sections with a pre-made template (ids regenerated).
  const applyTemplate = (tplId: string) => {
    const tpl = templates.find((x) => x.id === tplId);
    if (!tpl) return;
    const hasContent = est.categories.some((c) => c.items.length > 0);
    if (hasContent && !window.confirm(`Load template "${tpl.name}"? This replaces the current line items.`)) return;
    setSaved(false);
    setActiveTemplate(tpl.name);
    setEst((e) => ({
      ...e,
      categories: tpl.categories.map((c) => ({
        id: newId("c"),
        name: c.name,
        items: c.items.map((it) => ({ ...it, id: newId("i"), code: it.code || codeOfTask(it.task) })),
      })),
    }));
  };
  // Save the current sheet as a reusable template (progress reset to 0).
  const saveAsTemplate = () => {
    const name = window.prompt("Template name (e.g. AEC.MyVillaType)", "AEC.Custom");
    if (!name) return;
    const tpl: EstimateTemplate = {
      id: name,
      name,
      description: "Custom template",
      categories: est.categories.map((c) => ({
        name: c.name,
        items: c.items.map((it) => ({
          task: it.task,
          qty: it.qty,
          unit: it.unit,
          laborNorm: it.laborNorm,
          materialUnitCost: it.materialUnitCost,
          equipmentUnitCost: it.equipmentUnitCost,
          subcontractUnitCost: it.subcontractUnitCost,
          poc: 0,
        })),
      })),
    };
    const next = [...templates.filter((x) => x.id !== tpl.id), tpl];
    setTemplates(next);
    setActiveTemplate(name);
    void saveTemplatesAction(next); // persist the firm template library
  };

  // Totals
  const catTotals = (c: EstimateCategory): Totals =>
    c.items.reduce((acc, it) => sum(acc, calcItem(it, rate)), ZERO);
  const grand = est.categories.reduce((acc, c) => sum(acc, catTotals(c)), ZERO);
  const direct = grand.total;
  const gcAmount = gcActive ? sumGeneralConditions(generalConditions) : 0;
  const markupBase = direct + gcAmount; // General Conditions / Overhead sit on top of direct cost, before profit/BBO
  const profit = (markupBase * est.profitPct) / 100;
  const bbo = (markupBase * est.bboPct) / 100;
  const grandTotal = markupBase + profit + bbo;
  const grandPocPct = pocPct(grand); // overall % of work completed (value-weighted)
  // Imported Materials, Equipment & Logistics — the EQUIPMENT column of direct cost.
  // The user books all imported materials, equipment & logistics under Equipment, so
  // this line equals the equipment total (Material stays its own line). Surfaced as its
  // own line/segment only when the Print Control toggle is on.
  const importedAmount = grand.equip;
  const imOn = pc.importedMaterials;
  const money = (n: number) => `${est.currency} ${nf0(n)}`;
  // When the USD secondary unit is on, show "$ … · <system unit> …" — the USD
  // equivalent printed to the LEFT of the main system unit (e.g. AWG).
  const dualMoney = (n: number) =>
    usdSecondary ? `$ ${nf0(n * usdRate)} · ${est.currency} ${nf0(n)}` : money(n);
  // The FX state lives in the workspace (so it persists), which means changing it does
  // not touch `est` — re-arm the autosave by hand, or the new rate would never be written.
  const editUsdSecondary = (v: boolean) => { setSaved(false); setUsdSecondary(v); };
  const editUsdRate = (v: number) => { setSaved(false); setUsdRate(v); };

  // Grand-total rows fed to the Smart Page-Break Engine renderer (kept as one block).
  // When Imported Materials is on, the equipment portion is split out of Direct Cost
  // into its own line so the buildup still sums to the grand total.
  const grandTotalRows: GrandTotalRow[] = [
    { label: imOn ? "Direct Cost (excl. imported)" : "Direct Cost", value: dualMoney(imOn ? direct - importedAmount : direct) },
    ...(imOn ? [{ label: "Imported Materials, Equipment & Logistics", value: dualMoney(importedAmount) }] : []),
    // The recap GC line follows whether GC is active (it's part of the total buildup),
    // independent of the Print Control "General Conditions" PAGE toggle.
    ...(gcActive ? [{ label: "General Conditions / Overhead", value: dualMoney(gcAmount) }] : []),
    { label: `Profit & Risk (${est.profitPct}%)`, value: dualMoney(profit) },
    { label: `BBO (${est.bboPct}%)`, value: dualMoney(bbo) },
    { label: "Grand Total", value: dualMoney(grandTotal), emphasize: true },
  ];
  const printControl: PrintControl = pc;
  // Cost-breakdown chart segments (cover page) — only non-zero components.
  // `amount` carries the (optionally dual-currency) money string; Profit & Risk / BBO
  // use `pctOverride` so their label reads the markup rate (matching the summary),
  // not their share of the grand total.
  const chartData = [
    { label: "Labor", value: grand.labor, color: "#3b82f6", amount: dualMoney(grand.labor) },
    { label: "Material", value: grand.mat, color: "#10b981", amount: dualMoney(grand.mat) },
    imOn
      ? { label: "Imported Mat., Equip. & Log.", value: importedAmount, color: "#0ea5e9", amount: dualMoney(importedAmount) }
      : { label: "Equipment", value: grand.equip, color: "#f59e0b", amount: dualMoney(grand.equip) },
    { label: "Sub-Contractor", value: grand.sub, color: "#8b5cf6", amount: dualMoney(grand.sub) },
    ...(gcActive ? [{ label: "General Conditions / Overhead", value: gcAmount, color: "#64748b", amount: dualMoney(gcAmount) }] : []),
    { label: "Profit & Risk", value: profit, color: "#22c55e", pctOverride: est.profitPct, amount: dualMoney(profit) },
    { label: "BBO", value: bbo, color: "#f43f5e", pctOverride: est.bboPct, amount: dualMoney(bbo) },
  ].filter((s) => s.value > 0);
  // Built-up area → per-m² metrics; null until an area is entered.
  const area = est.gfa ?? 0;
  const perM2 = (n: number): number | null => (area > 0 ? n / area : null);
  const m2money = (n: number): string => {
    const v = perM2(n);
    return v === null ? "—" : `${est.currency} ${nf2(v)}`;
  };
  // Optional USD secondary unit.
  const usdAmt = (n: number) => n * usdRate;

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    // `budget` is built by the workspace — one payload, every key, every writer.
    const res = await saveEstimateAction({ ...est, budget });
    setSaving(false);
    if (res.ok) setSaved(true);
    else setSaveError(res.error);
  }

  // ── Data-loss protection ────────────────────────────────────────────────
  // 1) Debounced local backup + server autosave. 2.5s after the last edit we
  //    write a local copy (instant, offline-proof) and push to the server, so
  //    work is never more than a few seconds from being persisted.
  useEffect(() => {
    // A locked version is frozen: don't autosave it. The server would refuse the write
    // anyway — this just stops a pointless request and a scary error toast every 2.5s.
    if (saved || est.locked) return;
    const t = window.setTimeout(() => {
      if (draftKey) {
        try {
          window.localStorage.setItem(draftKey, JSON.stringify({ est, schedule, payment, takeoff, takeoffSection, ts: Date.now() }));
        } catch {
          /* storage full/unavailable — server autosave below still runs */
        }
      }
      if (est.id && !saving) void onSave();
    }, 2500);
    return () => window.clearTimeout(t);
    // onSave omitted intentionally: it is redefined each render with fresh state.
    // `budget` covers schedule/payment/takeoff/fx/gcActive/rebar in one memoised object,
    // so a new sub-config added there automatically re-arms this autosave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [est, budget, saved, saving, draftKey]);

  // 2) Once the server confirms the save, drop the local backup.
  useEffect(() => {
    if (saved && draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
  }, [saved, draftKey]);

  // 3) Warn before leaving/refreshing with unsaved changes (covers the debounce gap).
  useEffect(() => {
    if (saved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [saved]);

  function restoreDraft() {
    if (!pendingDraft) return;
    setEst(pendingDraft.est);
    setSaved(false);
    setPendingDraft(null);
  }
  function dismissDraft() {
    setPendingDraft(null);
    if (draftKey) {
      try {
        window.localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }
  }

  const body = (
    <div className="space-y-5">
      {/* Preview-only centered project line (single row) — mirrors the per-page print header. */}
      {preview && (
        <div className="only-preview text-center text-xs leading-tight text-muted">
          <span className="font-semibold text-fg">{est.projectName}</span> · No. {est.projectId ?? "—"} · {est.location} · Ver {est.version} · {est.date}
        </div>
      )}
      {/* Header / meta — editing controls; hidden in preview & print (preview shows the centered line above). */}
      {!preview && (
      <Card className="est-card no-print p-5">
        {/* Row 1 — title + primary actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {/* Title only. The Template badge and Print/PDF used to live here too — both are
              already in the workspace bar directly above, and a control shown twice reads
              as two different controls. */}
          <div className="min-w-0">
            <input
              value={est.projectName}
              onChange={(e) => patchMeta({ projectName: e.target.value })}
              className="w-full max-w-md rounded-md bg-transparent text-xl font-semibold text-fg outline-none focus:bg-brand/5"
              aria-label="Project name"
            />
            <div className="mt-0.5 text-xs text-faint">
              {saving ? "Saving…" : saved ? "All changes saved" : "Autosaves as you type"}
            </div>
          </div>

          {/* One primary action (Save). The occasional ones sit behind ⋯ so they stop
              competing with it for attention. */}
          <div className="flex shrink-0 items-center gap-2">
            {saveError ? <span className="self-center text-xs text-red-600" title={saveError}>Save failed</span> : null}
            <button onClick={onSave} type="button" disabled={saving} className={brandBtn}><Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}</button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                aria-expanded={moreOpen}
                aria-label="More actions"
                title="More actions"
                className={`${ghostBtn} px-2`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {moreOpen ? (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} />
                  <div className="absolute right-0 top-10 z-30 flex w-56 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-xl">
                    <SectionCopy
                      categories={est.categories}
                      onPaste={(cats) => {
                        setEst((e) => ({ ...e, categories: [...e.categories, ...cats] }));
                        setSaved(false);
                      }}
                    />
                    <EmailButton subject={`Estimate — ${est.projectName} (${est.version})`} attachment={`${est.projectName} — Estimate ${est.version}.pdf`} />
                    <button onClick={() => { setMoreOpen(false); setPreview(true); }} type="button" className={`${ghostBtn} w-full justify-start`}>
                      <Eye className="h-4 w-4" /> Preview &amp; Print
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Row 2 — project identity. Built-up Area joins the other fields instead of
            floating in the title row: it's a field, so it belongs with the fields. */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Project No.">
            <input value={est.projectId ?? ""} onChange={(e) => patchMeta({ projectId: e.target.value })} placeholder="—" className={metaInput} />
          </Field>
          <Field label="Client">
            <input value={est.client ?? ""} onChange={(e) => patchMeta({ client: e.target.value })} placeholder="—" className={metaInput} />
          </Field>
          <Field label="Version">
            <input value={est.version} onChange={(e) => patchMeta({ version: e.target.value })} className={metaInput} />
          </Field>
          <Field label="Date">
            <input type="date" value={est.date} onChange={(e) => patchMeta({ date: e.target.value })} className={metaInput} />
          </Field>
          <Field label="Location">
            <input value={est.location} onChange={(e) => patchMeta({ location: e.target.value })} className={metaInput} />
          </Field>
          <Field label="Built-up Area (m²)">
            <input
              type="number"
              min={0}
              value={area || ""}
              placeholder="0"
              onChange={(e) => patchMeta({ gfa: Number(e.target.value) || 0 })}
              className={metaInput}
            />
          </Field>
        </div>

        {/* Row 3 — settings toolbar: Pricing · Cost Database · View as three equal
            columns on one row (stacks on small screens). */}
        <div className="mt-4 flex flex-nowrap items-stretch gap-3 border-t border-border pt-4">
          <ToolGroup label="Pricing" className="shrink-0">
            <span className="inline-flex flex-col">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-xs text-muted">{est.currency}</span>
                <input type="number" min={0} value={est.avgLaborRate} onChange={(e) => patchMeta({ avgLaborRate: Number(e.target.value) || 0 })} className="w-14 bg-transparent text-base font-semibold text-fg outline-none focus:bg-brand/5" />
                <span className="text-[11px] text-muted">/hr</span>
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-faint leading-none">Average Labor Rate</span>
            </span>
            <span className="h-5 w-px bg-border" />
            <select value="" onChange={(e) => { const v = e.target.value; e.currentTarget.value = ""; if (v) applyTemplate(v); }} className="h-7 rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg outline-none focus:bg-brand/5">
              <option value="">Load template…</option>
              {templates.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
            </select>
            <button type="button" onClick={saveAsTemplate} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg hover:bg-surface-2"><Save className="h-3 w-3" /> Save as…</button>
          </ToolGroup>

          {/* Cost Database — four controls you set once per estimate, folded behind one
              button that states the current source. Set-and-forget settings don't earn
              permanent space next to the ones you flip while working. */}
          <ToolGroup label="Cost Database" className="min-w-0">
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setCostDbOpen((v) => !v)}
                aria-expanded={costDbOpen}
                title="Cost source, indexation and regional adjustment"
                className={`inline-flex h-7 min-w-0 max-w-[190px] items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${costDbOpen ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-fg hover:bg-surface-2"}`}
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{costSources.find((s) => s.id === costSourceId)?.name ?? "Source"}</span>
                {applyIndex || applyRegional ? (
                  <span className="shrink-0 rounded bg-brand/15 px-1 text-[10px] font-semibold text-brand">
                    {[applyIndex && "idx", applyRegional && "adj"].filter(Boolean).join(" ")}
                  </span>
                ) : null}
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </button>
              {costDbOpen ? (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setCostDbOpen(false)} />
                  <div className="absolute left-0 top-9 z-30 w-64 rounded-lg border border-border bg-surface p-2.5 shadow-xl">
                    <label className="mb-1 block text-[11px] font-medium text-muted">Source</label>
                    <select value={costSourceId} onChange={(e) => setCostSourceId(e.target.value)} className="mb-2 h-8 w-full rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg outline-none">
                      {costSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <label className="mb-1.5 flex items-center gap-2 text-xs text-fg">
                      <input type="checkbox" checked={applyIndex} onChange={(e) => setApplyIndex(e.target.checked)} className="accent-brand" />
                      Apply indexation
                    </label>
                    <label className="mb-1.5 flex items-center gap-2 text-xs text-fg">
                      <input type="checkbox" checked={applyRegional} onChange={(e) => setApplyRegional(e.target.checked)} className="accent-brand" />
                      Regional adjustment
                    </label>
                    <select value={regionTarget} onChange={(e) => setRegionTarget(e.target.value)} disabled={!applyRegional} className="h-8 w-full rounded-md border border-border bg-surface px-2 text-xs font-medium text-fg outline-none disabled:opacity-40">
                      {REGION_TARGETS.map((t) => <option key={`${t.country}|${t.region}`} value={`${t.country}|${t.region}`}>{t.region}</option>)}
                    </select>
                  </div>
                </>
              ) : null}
            </div>
          </ToolGroup>

          <ToolGroup label="View" className="shrink-0">
            <Switch on={showProgress} onClick={() => setShowProgress((v) => !v)} label="Progress" tone="green" />
            <Switch on={clientVersion} onClick={() => {
              const nv = !clientVersion;
              setClientVersion(nv);
              if (nv) setOrient("portrait");
              // Client mode = section subtotals only: auto-hide the per-row detail
              // columns (restored when Client mode is turned back off).
              // Rate columns are internal build-up — never restored by leaving Client mode.
              setPc((p) => ({
                ...p,
                labor: !nv, material: !nv, equipment: !nv, subcontractor: !nv, qtyUnit: !nv,
                ...(nv ? { laborNorm: false, laborHrs: false, materialUnit: false, equipmentUnit: false, subUnit: false } : {}),
              }));
            }} label="Client" tone="brand" />
            <Switch on={usdSecondary} onClick={() => editUsdSecondary(!usdSecondary)} label="$ USD" tone="brand" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setPcOpen((v) => !v)}
                aria-expanded={pcOpen}
                className={`inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors ${pcOpen ? "border-brand/40 bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:bg-surface-2"}`}
              >
                <Printer className="h-3.5 w-3.5" /> Print Control
                {/* The active print template, shown WITHOUT opening the panel.
                  * Which template is in force changes what the printed sheet
                  * contains, so it belongs where it can be read at a glance —
                  * finding out by opening a dropdown is a question the toolbar
                  * should already have answered. "Custom" = settings that match
                  * no saved template. */}
                <span
                  title={activePrintTemplate ? `Print template: ${activePrintTemplate}` : "Print settings not saved as a template"}
                  className={`max-w-[10rem] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    activePrintTemplate ? "bg-brand/10 text-brand" : "bg-surface-2 text-faint"
                  }`}
                >
                  {activePrintTemplate || "Custom"}
                </span>
              </button>
              {pcOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setPcOpen(false)} aria-hidden />
                  <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-xl">
                    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Print Control</div>
                    <div className="mb-2.5">
                      <div className="mb-1 text-[11px] font-medium text-muted">Estimation Print Template</div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={activePrintTemplate}
                          onChange={(e) => loadPrintTemplate(e.target.value)}
                          title="Load a saved print template"
                          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-surface px-2 text-[11px] font-medium text-fg outline-none focus:border-brand"
                        >
                          <option value="">Load template…</option>
                          {Object.keys(printTemplates).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={savePrintTemplate}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] font-medium text-fg hover:bg-surface-2"
                        >
                          <Save className="h-3 w-3" /> Save
                        </button>
                        {activePrintTemplate ? (
                          <button
                            type="button"
                            onClick={() => deletePrintTemplate(activePrintTemplate)}
                            aria-label="Delete template"
                            title="Delete this template"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-faint hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mb-2.5">
                      <div className="mb-1 text-[11px] font-medium text-muted">Print Text Size</div>
                      <div className="inline-flex w-full overflow-hidden rounded-lg border border-border">
                        {(["normal", "medium", "small"] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setPrintSize(s)}
                            className={`flex-1 px-2 py-1 text-[11px] font-medium capitalize transition-colors ${printSize === s ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Cover Page — a leading title page with the project's headline facts
                        and a rendering. Its own block (not just a toggle row) because when
                        it's on it reveals an image uploader. */}
                    <div className="mb-2.5 rounded-lg border border-border p-2">
                      <PcRow label="Cover Page" on={coverOn} onToggle={() => setCoverOn(!coverOn)} />
                      {coverOn ? (
                        <div className="mt-1.5 border-t border-border pt-1.5">
                          {coverImage ? (
                            <div className="space-y-1.5">
                              {/* eslint-disable-next-line @next/next/no-img-element -- data URL preview */}
                              <img src={coverImage} alt="Cover" className="h-20 w-full rounded-md border border-border object-cover" />
                              <div className="flex gap-1.5">
                                <label className="flex-1 cursor-pointer rounded-md border border-border bg-surface px-2 py-1 text-center text-[11px] font-medium text-fg hover:bg-surface-2">
                                  Replace
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0] ?? null)} />
                                </label>
                                <button type="button" onClick={() => { setCoverImage(null); setCoverErr(null); }} className="rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-surface-2">
                                  Remove
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border px-2 py-3 text-center hover:bg-surface-2">
                              <ImagePlus className="h-4 w-4 text-faint" />
                              <span className="text-[11px] font-medium text-muted">Upload image / rendering</span>
                              <span className="text-[10px] text-faint">Optional — the page still prints the project facts</span>
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0] ?? null)} />
                            </label>
                          )}
                          {coverErr ? <div className="mt-1 text-[10px] text-red-500">{coverErr}</div> : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mb-1 text-[11px] font-medium text-muted">Include in print</div>
                    <div className="space-y-0.5">
                      <PcRow label="Qty & Unit" on={pc.qtyUnit} onToggle={() => setPc((p) => ({ ...p, qtyUnit: !p.qtyUnit }))} />
                      <PcRow label="Labor Norm hrs/unit" on={!!pc.laborNorm} onToggle={() => setPc((p) => ({ ...p, laborNorm: !p.laborNorm }))} />
                      <PcRow label="Labor Hrs" on={!!pc.laborHrs} onToggle={() => setPc((p) => ({ ...p, laborHrs: !p.laborHrs }))} />
                      <PcRow label="Labor" on={pc.labor} onToggle={() => setPc((p) => ({ ...p, labor: !p.labor }))} />
                      <PcRow label="Material Unit Cost" on={!!pc.materialUnit} onToggle={() => setPc((p) => ({ ...p, materialUnit: !p.materialUnit }))} />
                      <PcRow label="Material" on={pc.material} onToggle={() => setPc((p) => ({ ...p, material: !p.material }))} />
                      <PcRow label="Equipment Unit Cost" on={!!pc.equipmentUnit} onToggle={() => setPc((p) => ({ ...p, equipmentUnit: !p.equipmentUnit }))} />
                      <PcRow label="Equipment" on={pc.equipment} onToggle={() => setPc((p) => ({ ...p, equipment: !p.equipment }))} />
                      <PcRow label="Subcontractor Unit Cost" on={!!pc.subUnit} onToggle={() => setPc((p) => ({ ...p, subUnit: !p.subUnit }))} />
                      <PcRow label="Subcontractor" on={pc.subcontractor} onToggle={() => setPc((p) => ({ ...p, subcontractor: !p.subcontractor }))} />
                      <PcRow label="Progress" on={showProgress} onToggle={() => setShowProgress((v) => !v)} />
                      <PcRow label="Page #" on={pc.pageNum} onToggle={() => setPc((p) => ({ ...p, pageNum: !p.pageNum }))} />
                      <PcRow label="General Conditions / Overhead" on={gcActive && pc.generalConditions} disabled={!gcActive} onToggle={() => setPc((p) => ({ ...p, generalConditions: !p.generalConditions }))} />
                      <PcRow label="Zebra Rows" on={pc.zebra} onToggle={() => setPc((p) => ({ ...p, zebra: !p.zebra }))} />
                      <PcRow label="Shaded Row SubTotal+%" on={pc.rowSubtotal} onToggle={() => setPc((p) => ({ ...p, rowSubtotal: !p.rowSubtotal }))} />
                      <PcRow label="Logo" on={pc.logo} onToggle={() => setPc((p) => ({ ...p, logo: !p.logo }))} />
                      {pc.logo ? (
                        <div className="flex items-center gap-2 px-2 py-1">
                          <span className="shrink-0 text-[11px] text-muted">Logo Scale</span>
                          <input
                            type="range"
                            min={0.4}
                            max={2}
                            step={0.05}
                            value={logoScale}
                            onChange={(e) => setLogoScale(Number(e.target.value))}
                            className="h-1 flex-1 accent-brand"
                          />
                          <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-fg">{Math.round(logoScale * 100)}%</span>
                        </div>
                      ) : null}
                      <PcRow label="Timeline" on={pc.timeline} onToggle={() => setPc((p) => ({ ...p, timeline: !p.timeline }))} />
                      <PcRow label="Phase Disbursement" on={pc.phaseDisbursement} onToggle={() => setPc((p) => ({ ...p, phaseDisbursement: !p.phaseDisbursement }))} />
                      <PcRow label="Imported Materials, Equipm. & Log." on={pc.importedMaterials} onToggle={() => setPc((p) => ({ ...p, importedMaterials: !p.importedMaterials }))} />
                      <PcRow label="Memo/Remark" on={pc.memo} onToggle={() => setPc((p) => ({ ...p, memo: !p.memo }))} />
                      <PcRow label="Chart" on={pc.chart} onToggle={() => setPc((p) => ({ ...p, chart: !p.chart }))} />
                      <PcRow label="Calc. Method Details" on={!!pc.methodDetail} onToggle={() => setPc((p) => ({ ...p, methodDetail: !p.methodDetail }))} />

                      {/* Collapsed Sections — which sections print as a header + subtotal
                          only. Separate from the on-screen red arrows on purpose: folding
                          a section away while you work must not silently drop its lines
                          from the client's PDF. */}
                      <div className="mt-1 border-t border-border pt-1">
                        <button
                          type="button"
                          onClick={() => setPcCollapseOpen((v) => !v)}
                          aria-expanded={pcCollapseOpen}
                          className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
                        >
                          {pcCollapseOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          Collapsed Sections
                          <span className="ml-auto rounded bg-surface-2 px-1.5 text-[10px] tabular-nums text-faint">
                            {printCollapsed.length}/{est.categories.length}
                          </span>
                        </button>
                        {pcCollapseOpen ? (
                          <div className="mt-0.5 space-y-0.5 pl-2">
                            <div className="flex gap-2 px-2 pb-1">
                              <button type="button" onClick={() => setPc((p) => ({ ...p, collapsedSections: est.categories.map((c) => c.id) }))} className="text-[10px] font-medium text-brand hover:underline">
                                All
                              </button>
                              <button type="button" onClick={() => setPc((p) => ({ ...p, collapsedSections: [] }))} className="text-[10px] font-medium text-muted hover:underline">
                                None
                              </button>
                            </div>
                            {est.categories.length ? (
                              est.categories.map((c) => (
                                <PcRow
                                  key={c.id}
                                  label={c.name || "—"}
                                  on={printCollapsed.includes(c.id)}
                                  onToggle={() =>
                                    setPc((p) => {
                                      const cur = p.collapsedSections ?? [];
                                      return {
                                        ...p,
                                        collapsedSections: cur.includes(c.id)
                                          ? cur.filter((x) => x !== c.id)
                                          : [...cur, c.id],
                                      };
                                    })
                                  }
                                />
                              ))
                            ) : (
                              <div className="px-2 py-1 text-[11px] text-faint">No sections yet.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ToolGroup>
        </div>
        {saved ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" /> Estimate captured locally — persistence goes live with the database (Supabase).
          </div>
        ) : null}
      </Card>
      )}

      {/* Sheet — full detail; hidden when Client Version is on. */}
      {!clientVersion && (
      <Card className="est-card overflow-hidden">
        <div className="est-scroll overflow-x-hidden">
          <datalist id="normset-tasks">
            {normSet.map((n) => (
              <option key={n.id} value={n.task} />
            ))}
          </datalist>
          <datalist id="pricelist-codes">
            {[...materials, ...equipment].map((p) => (
              <option key={p.id} value={p.code}>{p.name}</option>
            ))}
          </datalist>
          <datalist id="section-codes">
            <option value="A10">Substructure — Foundations</option>
            <option value="A20">Basement Construction</option>
            <option value="B10">Superstructure (frame · floors)</option>
            <option value="B20">Exterior Enclosure</option>
            <option value="B30">Roofing</option>
            <option value="C10">Interior Construction</option>
            <option value="C20">Stairs</option>
            <option value="C30">Interior Finishes</option>
            <option value="D20">Plumbing</option>
            <option value="D30">HVAC</option>
            <option value="D50">Electrical</option>
            <option value="E10">Equipment & Furnishings</option>
            <option value="G10">Site Work</option>
          </datalist>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {COLW.map((w, i) => (
                <col key={i} style={{ width: w }} className={colClass[i] || undefined} />
              ))}
            </colgroup>
            <thead>
              {/* Print-only running header — compact single line, repeats atop every page with the thead. */}
              <tr className="print-page-head hidden">
                <th colSpan={colCount} className="border-b border-slate-300 bg-white px-1 py-0.5 text-center">
                  <div className="text-center text-[9px] font-normal normal-case leading-tight tracking-normal text-slate-600">
                    <span className="font-semibold text-slate-800">{est.projectName}</span> · No. {est.projectId ?? "—"} · {est.location} · Ver {est.version} · {est.date}
                  </div>
                </th>
              </tr>
              <tr className="text-[10px] uppercase tracking-wide text-slate-200">
                <th rowSpan={2} className="sticky left-0 z-10 border-b border-r border-slate-700 bg-slate-800 pl-0.5 pr-2 py-1.5 text-left text-slate-100">Code · Task</th>
                <th rowSpan={2} className="pc-qtyunit border-b border-slate-700 bg-slate-800 px-1 py-1.5 text-center text-slate-100">Qty</th>
                <th rowSpan={2} className="pc-qtyunit border-b border-slate-700 bg-slate-800 px-1 py-1.5 text-center text-slate-100">Unit</th>
                <th colSpan={3} className="pc-labor border-b-2 border-b-blue-400 border-l border-slate-600 bg-slate-800 px-2 py-1 text-center font-semibold text-white">Labor</th>
                <th colSpan={2} className="pc-material border-b-2 border-b-emerald-400 border-l border-slate-600 bg-slate-800 px-2 py-1 text-center font-semibold text-white">Material</th>
                <th colSpan={2} className="pc-equipment border-b-2 border-b-amber-400 border-l border-slate-600 bg-slate-800 px-2 py-1 text-center font-semibold text-white">Equipment</th>
                <th colSpan={2} className="pc-subcontractor border-b-2 border-b-violet-400 border-l border-slate-600 bg-slate-800 px-1 py-0.5 text-center font-semibold text-white">Subcontractor</th>
                <th rowSpan={2} className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1 text-center text-slate-100">Item Total</th>
                {showProgress && (
                  <th colSpan={2} className="border-b-2 border-b-green-300 border-l-2 border-slate-500 bg-green-700 px-1 py-0.5 text-center font-semibold text-white">Progress</th>
                )}
                <th rowSpan={2} className="no-print border-b border-slate-700 bg-slate-800 px-1 py-1" />
              </tr>
              <tr className="text-[9px] uppercase tracking-wide text-muted">
                <th className="pc-labor border-b border-l border-border bg-blue-500/10 px-1 py-0.5 text-center">Norm hrs/u</th>
                <th className="pc-labor border-b border-l border-dotted border-black/40 bg-blue-500/10 px-1 py-0.5 text-center">Total Hrs</th>
                <th className="pc-labor border-b border-l border-dotted border-black/40 bg-blue-500/10 px-1 py-0.5 text-center">Labor Cost</th>
                <th className="pc-material border-b border-l border-border bg-emerald-500/10 px-1 py-0.5 text-center">Unit Cost</th>
                <th className="pc-material border-b border-l border-dotted border-black/40 bg-emerald-500/10 px-1 py-0.5 text-center">Total</th>
                <th className="pc-equipment border-b border-l border-border bg-amber-500/10 px-1 py-0.5 text-center">Unit Cost</th>
                <th className="pc-equipment border-b border-l border-dotted border-black/40 bg-amber-500/10 px-1 py-0.5 text-center">Total</th>
                <th className="pc-subcontractor border-b border-l border-border bg-violet-500/10 px-1 py-0.5 text-center">Unit Cost</th>
                <th className="pc-subcontractor border-b border-l border-dotted border-black/40 bg-violet-500/10 px-1 py-0.5 text-center">Total</th>
                {showProgress && (
                  <>
                    <th className="border-b border-l-2 border-slate-500 bg-green-500/15 px-1 py-0.5 text-center text-green-400">POC %</th>
                    <th className="border-b border-l border-dotted border-black/40 bg-green-500/15 px-1 py-0.5 text-center text-green-400">Prog. Amt</th>
                  </>
                )}
              </tr>
            </thead>

            {est.categories.map((cat) => {
              const ct = catTotals(cat);
              return (
                <tbody key={cat.id} className="border-b border-border">
                  {/* Category header */}
                  <tr className="est-cat-head bg-surface-2">
                    <td colSpan={colCount} className="border-y border-border px-3 py-0.5">
                      <div className="flex items-center gap-2">
                        {/* Collapse — folds the section down to its header + subtotal, so a
                            long sheet can be read as a list of sections. View-only: it does
                            not touch the data or what prints (Print Control owns that). */}
                        <button
                          type="button"
                          onClick={() => toggleCollapse(cat.id)}
                          aria-label={isCollapsed(cat.id) ? "Expand section" : "Collapse section"}
                          aria-expanded={!isCollapsed(cat.id)}
                          title={isCollapsed(cat.id) ? "Expand section" : "Collapse section — show section rows only"}
                          className="no-print flex h-5 w-4 shrink-0 items-center justify-center text-red-500 hover:text-red-400"
                        >
                          {isCollapsed(cat.id) ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <input
                          value={cat.code ?? ""}
                          onChange={(e) => patchCat(cat.id, { code: e.target.value.toUpperCase() })}
                          list="section-codes"
                          placeholder="—"
                          title="Section classification code (UniFormat)"
                          className="w-[60px] shrink-0 rounded bg-transparent px-1 py-0 font-mono text-[11px] font-semibold uppercase tracking-tight text-muted outline-none focus:bg-brand/5"
                        />
                        <input
                          value={cat.name}
                          onChange={(e) => patchCat(cat.id, { name: e.target.value })}
                          className="rounded bg-transparent text-xs font-semibold uppercase tracking-wide text-fg outline-none focus:bg-brand/5"
                        />
                        <span className="rounded bg-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted" title="Share of direct cost">{nf0(direct > 0 ? (ct.total / direct) * 100 : 0)}%</span>
                        <span className="no-print ml-auto flex items-center text-faint">
                          <button type="button" onClick={() => moveCategory(cat.id, -1)} aria-label="Move section up" className="flex h-5 w-4 items-center justify-center hover:text-brand">
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => moveCategory(cat.id, 1)} aria-label="Move section down" className="flex h-5 w-4 items-center justify-center hover:text-brand">
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </span>
                        <select
                          value=""
                          onChange={(e) => { const v = e.target.value; e.currentTarget.value = ""; if (v) addItemFromNorm(cat.id, v); }}
                          aria-label="Add from Norm Set"
                          title="Add a standard task with its fixed Norm Hrs/Unit"
                          className="no-print h-5 rounded border border-green-400 bg-green-500/10 px-1.5 text-[11px] font-medium text-green-400 outline-none focus:bg-green-500/15"
                        >
                          <option value="">＋ Norm Set…</option>
                          {trades.map((trade) => (
                            <optgroup key={trade} label={trade}>
                              {normSet.filter((n) => n.trade === trade).map((n) => (
                                <option key={n.id} value={n.id}>{n.task} · {n.laborNorm} hr/{n.unit}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <select
                          value=""
                          onChange={(e) => { const v = e.target.value; e.currentTarget.value = ""; if (v) addCostItem(cat.id, v); }}
                          aria-label="Add from Cost Database"
                          title="Insert a priced item from the Cost Database (indexed / adjusted per the toolbar settings)"
                          className="no-print h-5 rounded border border-blue-500/40 bg-blue-500/10 px-1.5 text-[11px] font-medium text-blue-400 outline-none focus:bg-blue-500/20"
                        >
                          <option value="">＋ Cost DB…</option>
                          {costItemRegions.map((rg) => (
                            <optgroup key={rg} label={rg}>
                              {costItemsForSource.filter((i) => (i.region ?? "—") === rg).map((ci) => (
                                <option key={ci.id} value={ci.id}>{ci.title} · {ci.currency} {ci.baseCost}/{ci.unit}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <button type="button" onClick={() => addItem(cat.id)} className="no-print inline-flex h-5 items-center gap-1 rounded border border-border bg-surface px-1.5 text-[11px] font-medium text-fg hover:bg-surface-2">
                          <Plus className="h-3 w-3" /> Item
                        </button>
                        <button type="button" onClick={() => removeCategory(cat.id)} aria-label="Remove section" className="no-print inline-flex h-5 w-5 items-center justify-center rounded text-faint hover:text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Items — hidden while the section is collapsed (the subtotal stays). */}
                  {(isCollapsed(cat.id) ? [] : cat.items).map((it) => {
                    const c = calcItem(it, rate);
                    const method = it.calculationMethod ?? "norm";
                    const isRate = method === "labor_rate";
                    const isAsm = method === "assembly";
                    const asmOpen = openAsm.has(it.id);
                    return (
                      <Fragment key={it.id}>
                      <tr className="border-t border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-brand/5">
                        <td className="sticky left-0 z-10 border-r border-border bg-surface px-2 py-0.5">
                          <div className="flex items-start gap-1">
                            <span className="no-print flex items-center pt-px text-faint">
                              <button type="button" onClick={() => moveItem(cat.id, it.id, -1)} aria-label="Move row up" className="flex h-4 w-3.5 items-center justify-center hover:text-brand">
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button type="button" onClick={() => moveItem(cat.id, it.id, 1)} aria-label="Move row down" className="flex h-4 w-3.5 items-center justify-center hover:text-brand">
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </span>
                            <input
                              value={it.code ?? ""}
                              onChange={(e) => patchItem(cat.id, it.id, { code: e.target.value.toUpperCase() })}
                              list="pricelist-codes"
                              placeholder="CODE"
                              title="Price-list code"
                              className={`w-[84px] shrink-0 rounded bg-surface-2 px-1 py-0 ${FIELD_H} text-left font-mono text-[10px] uppercase tracking-tight text-muted outline-none focus:bg-brand/5`}
                            />
                          <TaskField
                            value={it.task}
                            placeholder="Description"
                            title={it.task}
                            onChange={(v) => {
                              const m = normSet.find((n) => n.task.toLowerCase() === v.toLowerCase());
                              patchItem(cat.id, it.id, m
                                ? {
                                    task: m.task,
                                    code: it.code || m.code || "",
                                    unit: m.unit,
                                    laborNorm: m.laborNorm,
                                    materialUnitCost: it.materialUnitCost || m.materialUnitCost || 0,
                                    equipmentUnitCost: it.equipmentUnitCost || m.equipmentUnitCost || 0,
                                    subcontractUnitCost: it.subcontractUnitCost || m.subcontractUnitCost || 0,
                                  }
                                : { task: v });
                            }}
                            className="w-full min-w-0 resize-none overflow-hidden rounded bg-transparent px-1 py-0 text-left text-[11px] leading-snug text-fg outline-none focus:bg-brand/5"
                          />
                          <select
                            value={it.calculationMethod ?? "norm"}
                            onChange={(e) => patchItem(cat.id, it.id, { calculationMethod: e.target.value as CalculationMethod })}
                            title="Calculation method — Norm (hrs/u × rate), Labor/Rate ($ per unit), or Assembly (typed components)."
                            className={`no-print shrink-0 rounded border border-border bg-surface-2 px-0.5 ${FIELD_H} font-mono text-[9px] uppercase tracking-tight text-muted outline-none focus:bg-brand/5`}
                          >
                            <option value="norm">Norm</option>
                            <option value="labor_rate">$/u</option>
                            <option value="assembly">Asm</option>
                          </select>
                          {isAsm && (
                            <button
                              type="button"
                              onClick={() => toggleAsm(it.id)}
                              title="Edit assembly components"
                              className="no-print inline-flex shrink-0 items-center gap-0.5 rounded border border-brand/40 bg-brand/5 px-1 text-[9px] font-medium text-brand outline-none hover:bg-brand/10"
                            >
                              {asmOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {(it.assembly?.length ?? 0)}
                            </button>
                          )}
                          </div>
                        </td>
                        <td className="pc-qtyunit px-1 py-0">
                          <input type="number" value={it.qty} onChange={(e) => patchItem(cat.id, it.id, { qty: Number(e.target.value) || 0 })} className={cellInput} />
                        </td>
                        <td className="pc-qtyunit px-1 py-0">
                          <select value={it.unit} onChange={(e) => patchItem(cat.id, it.id, { unit: e.target.value })} className={`w-full rounded bg-transparent px-1 py-0 ${FIELD_H} text-[11px] leading-none text-fg outline-none focus:bg-brand/5`}>
                            {ESTIMATE_UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </td>
                        {/* Labor */}
                        <td className={`pc-labor ${grpDiv} bg-blue-500/10 px-1 py-0`}>
                          {isAsm ? (
                            <div className="text-center text-[10px] leading-4 text-faint" title="Hours come from the assembly components">—</div>
                          ) : (
                            <input type="number" step={0.05} value={it.laborNorm} onChange={(e) => patchItem(cat.id, it.id, { laborNorm: Number(e.target.value) || 0 })} className={cellInput} />
                          )}
                        </td>
                        <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10 text-muted`}>{nf2(c.hrs)}</td>
                        {isRate ? (
                          <td className={`pc-labor ${subDiv} bg-blue-500/10 px-1 py-0`} title={`Labor cost per unit · line labor = ${nf0(c.labor)}`}>
                            <div className="flex items-center">
                              <input
                                type="number"
                                value={it.laborRatePerUnit ?? 0}
                                onChange={(e) => patchItem(cat.id, it.id, { laborRatePerUnit: Number(e.target.value) || 0 })}
                                className={`${cellInput} text-blue-300`}
                              />
                              <span className="pointer-events-none -ml-3 text-[8px] text-faint">/u</span>
                            </div>
                          </td>
                        ) : (
                          <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10 font-medium`}>{nf0(c.labor)}</td>
                        )}
                        {/* Material */}
                        <td className={`pc-material ${grpDiv} bg-emerald-500/10 px-1 py-0`}>
                          {isAsm ? (
                            <div className="text-center text-[10px] leading-4 text-faint" title="Driven by assembly components">—</div>
                          ) : (
                            <input type="number" value={it.materialUnitCost} onChange={(e) => patchItem(cat.id, it.id, { materialUnitCost: Number(e.target.value) || 0 })} className={cellInput} />
                          )}
                        </td>
                        <td className={`pc-material ${calcCls} ${subDiv} bg-emerald-500/10 font-medium`}>{nf0(c.mat)}</td>
                        {/* Equipment */}
                        <td className={`pc-equipment ${grpDiv} bg-amber-500/10 px-1 py-0`}>
                          {isAsm ? (
                            <div className="text-center text-[10px] leading-4 text-faint" title="Driven by assembly components">—</div>
                          ) : (
                            <input type="number" value={it.equipmentUnitCost} onChange={(e) => patchItem(cat.id, it.id, { equipmentUnitCost: Number(e.target.value) || 0 })} className={cellInput} />
                          )}
                        </td>
                        <td className={`pc-equipment ${calcCls} ${subDiv} bg-amber-500/10 font-medium`}>{nf0(c.equip)}</td>
                        {/* Subcontractor */}
                        <td className={`pc-subcontractor ${grpDiv} bg-violet-500/10 px-1 py-0`}>
                          {isAsm ? (
                            <div className="text-center text-[10px] leading-4 text-faint" title="Driven by assembly components (incl. ‘other’)">—</div>
                          ) : (
                            <input type="number" value={it.subcontractUnitCost} onChange={(e) => patchItem(cat.id, it.id, { subcontractUnitCost: Number(e.target.value) || 0 })} className={cellInput} />
                          )}
                        </td>
                        <td className={`pc-subcontractor ${calcCls} ${subDiv} bg-violet-500/10 font-medium`}>{nf0(c.sub)}</td>
                        {/* Total */}
                        <td className={`${calcCls} ${grpDiv} font-semibold`}>{nf0(c.total)}</td>
                        {showProgress && (
                          <>
                            {/* Progress */}
                            <td className="border-l-2 border-slate-500 bg-green-500/10 px-1 py-0">
                              <input type="number" min={0} max={100} value={it.poc} onChange={(e) => patchItem(cat.id, it.id, { poc: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} className={`${cellInput} text-green-400`} />
                            </td>
                            <td className={`${calcCls} ${subDiv} bg-green-500/10 font-medium text-green-400`}>{nf0(c.prog)}</td>
                          </>
                        )}
                        <td className="no-print px-1 py-0 text-center">
                          <button type="button" onClick={() => removeItem(cat.id, it.id)} aria-label="Remove item" className="inline-flex h-4 w-6 items-center justify-center rounded text-faint hover:text-red-600">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                      {isAsm && asmOpen && (
                        <tr className="no-print bg-brand/[0.04]">
                          <td colSpan={colCount} className="border-b border-border px-3 py-2">
                            <AssemblyEditor
                              item={it}
                              currency={est.currency}
                              onChange={(assembly) => patchItem(cat.id, it.id, { assembly })}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}

                  {/* Category subtotal */}
                  <tr className="border-t border-border bg-surface-2/70 font-semibold">
                    <td colSpan={3} className="sticky left-0 z-10 border-r border-border bg-surface-2/70 px-3 py-0.5 text-center text-xs uppercase tracking-wide text-muted">
                      Subtotal — {cat.name}
                    </td>
                    <td className={`pc-labor ${grpDiv} bg-blue-500/10`} />
                    <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10 text-muted`}>{nf2(ct.hrs)}</td>
                    <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10`}>{nf0(ct.labor)}</td>
                    <td className={`pc-material ${grpDiv} bg-emerald-500/10`} />
                    <td className={`pc-material ${calcCls} ${subDiv} bg-emerald-500/10`}>{nf0(ct.mat)}</td>
                    <td className={`pc-equipment ${grpDiv} bg-amber-500/10`} />
                    <td className={`pc-equipment ${calcCls} ${subDiv} bg-amber-500/10`}>{nf0(ct.equip)}</td>
                    <td className={`pc-subcontractor ${grpDiv} bg-violet-500/10`} />
                    <td className={`pc-subcontractor ${calcCls} ${subDiv} bg-violet-500/10`}>{nf0(ct.sub)}</td>
                    <td className={`${calcCls} ${grpDiv}`}>{nf0(ct.total)}</td>
                    {showProgress && (
                      <>
                        <td className={`${calcCls} border-l-2 border-slate-500 bg-green-500/15 text-green-400`}>{nf0(pocPct(ct))}%</td>
                        <td className={`${calcCls} ${subDiv} bg-green-500/15 text-green-400`}>{nf0(ct.prog)}</td>
                      </>
                    )}
                    <td className="no-print" />
                  </tr>
                </tbody>
              );
            })}

            {/* Grand totals per column */}
            <tfoot>
              <tr className="border-t-2 border-border bg-surface text-sm font-bold">
                <td colSpan={3} className="sticky left-0 z-10 border-r border-border bg-surface px-3 py-2 text-right uppercase tracking-wide text-fg">
                  Direct Cost
                </td>
                <td className={`pc-labor ${grpDiv} bg-blue-500/10`} />
                <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10 text-muted`}>{nf2(grand.hrs)}</td>
                <td className={`pc-labor ${calcCls} ${subDiv} bg-blue-500/10 text-blue-400`}>{nf0(grand.labor)}</td>
                <td className={`pc-material ${grpDiv} bg-emerald-500/10`} />
                <td className={`pc-material ${calcCls} ${subDiv} bg-emerald-500/10 text-emerald-400`}>{nf0(grand.mat)}</td>
                <td className={`pc-equipment ${grpDiv} bg-amber-500/10`} />
                <td className={`pc-equipment ${calcCls} ${subDiv} bg-amber-500/10 text-amber-400`}>{nf0(grand.equip)}</td>
                <td className={`pc-subcontractor ${grpDiv} bg-violet-500/10`} />
                <td className={`pc-subcontractor ${calcCls} ${subDiv} bg-violet-500/10 text-violet-400`}>{nf0(grand.sub)}</td>
                <td className={`${calcCls} ${grpDiv}`}>{nf0(direct)}</td>
                {showProgress && (
                  <>
                    <td className={`${calcCls} border-l-2 border-slate-500 bg-green-500/15 text-green-400`}>{nf0(grandPocPct)}%</td>
                    <td className={`${calcCls} ${subDiv} bg-green-500/15 text-green-400`}>{nf0(grand.prog)}</td>
                  </>
                )}
                <td className="no-print" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* TOTAL DIRECT COSTS — standing footer line under the sheet. The tfoot above
         * breaks the same figure out per column; this is the single headline number,
         * always shown. Screen-only: the print document renders its own totals block,
         * so printing this too would state the figure twice. */}
        <div className="no-print flex items-baseline gap-3 border-t-2 border-border bg-surface-2/60 px-4 py-2.5 print:hidden">
          <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-fg">Total Direct Costs</span>
          <span aria-hidden className="min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-faint/60" />
          <span className="shrink-0 tabular-nums text-sm font-bold text-fg">{dualMoney(direct)}</span>
        </div>

        <div className="no-print border-t border-border p-3">
          <button type="button" onClick={addCategory} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2">
            <Plus className="h-3.5 w-3.5" /> Add section
          </button>
        </div>
      </Card>
      )}

      {/* Client Version — summary table: detail columns + per-line amounts hidden; shows section subtotals & grand total (portrait). */}
      {clientVersion && (
        <Card className="est-card overflow-hidden">
          <div className="est-scroll overflow-x-hidden">
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col style={{ width: showProgress ? "32%" : "37%" }} />
                <col style={{ width: showProgress ? "12%" : "13%" }} />
                <col style={{ width: showProgress ? "12%" : "13%" }} />
                <col style={{ width: showProgress ? "11%" : "12%" }} />
                <col style={{ width: showProgress ? "12%" : "13%" }} />
                <col style={{ width: showProgress ? "13%" : "12%" }} />
                {showProgress && <col style={{ width: "8%" }} />}
              </colgroup>
              <thead>
                <tr className="print-page-head hidden">
                  <th colSpan={clientCols} className="border-b border-slate-300 bg-white px-1 py-0.5 text-center">
                    <div className="text-center text-[9px] font-normal normal-case leading-tight tracking-normal text-slate-600">
                      <span className="font-semibold text-slate-800">{est.projectName}</span> · No. {est.projectId ?? "—"} · {est.location} · Ver {est.version} · {est.date}
                    </div>
                  </th>
                </tr>
                <tr className="text-[10px] uppercase tracking-wide text-slate-100">
                  <th className="border-b border-r border-slate-700 bg-slate-800 px-2 py-1.5 text-left">Code · Task</th>
                  <th className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1.5 text-center">Labor</th>
                  <th className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1.5 text-center">Material</th>
                  <th className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1.5 text-center">Equipment</th>
                  <th className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1.5 text-center">Subcontractor</th>
                  <th className="border-b border-l border-slate-600 bg-slate-800 px-2 py-1.5 text-center">Item Total</th>
                  {showProgress && <th className="border-b border-l border-slate-600 bg-green-700 px-2 py-1.5 text-center text-white">Progress</th>}
                </tr>
              </thead>
              {est.categories.map((cat) => {
                const ct = catTotals(cat);
                return (
                  <tbody key={cat.id} className="border-b border-border">
                    <tr className="bg-surface-2">
                      <td colSpan={clientCols} className="border-y border-border px-2 py-0.5 align-middle">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-fg">
                          <span className="w-16 shrink-0 font-mono text-[11px] text-muted">{cat.code}</span>
                          <span>{cat.name}</span>
                          <span className="rounded bg-slate-300/70 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted">{nf0(direct > 0 ? (ct.total / direct) * 100 : 0)}%</span>
                        </span>
                      </td>
                    </tr>
                    {cat.items.map((it) => (
                      <tr key={it.id} className="border-t border-border/70 odd:bg-surface even:bg-surface-2">
                        <td className="px-2 py-0.5 align-middle">
                          <span className="flex items-center gap-2">
                            <span className="w-16 shrink-0 font-mono text-[10px] text-muted">{it.code}</span>
                            <span className="text-[11px] text-fg">{it.task}</span>
                          </span>
                        </td>
                        <td className="border-l border-slate-200" />
                        <td className="border-l border-slate-200" />
                        <td className="border-l border-slate-200" />
                        <td className="border-l border-slate-200" />
                        <td className="border-l border-slate-200" />
                        {showProgress && <td className="border-l border-slate-200" />}
                      </tr>
                    ))}
                    <tr className="border-t border-border bg-surface-2/70 text-xs font-semibold">
                      <td className="px-2 py-1 text-right uppercase tracking-wide text-muted">Subtotal — {cat.name}</td>
                      <td className="border-l border-border px-2 py-1 text-right tabular-nums text-fg">{nf0(ct.labor)}</td>
                      <td className="border-l border-border px-2 py-1 text-right tabular-nums text-fg">{nf0(ct.mat)}</td>
                      <td className="border-l border-border px-2 py-1 text-right tabular-nums text-fg">{nf0(ct.equip)}</td>
                      <td className="border-l border-border px-2 py-1 text-right tabular-nums text-fg">{nf0(ct.sub)}</td>
                      <td className="border-l border-border px-2 py-1 text-right font-bold tabular-nums text-fg">{nf0(ct.total)}</td>
                      {showProgress && <td className="border-l border-border px-2 py-1 text-right tabular-nums text-green-400">{nf0(ct.prog)}</td>}
                    </tr>
                  </tbody>
                );
              })}
              <tfoot>
                <tr className="border-t-2 border-border bg-surface text-sm font-bold">
                  <td className="px-2 py-2 text-right uppercase tracking-wide text-fg">Direct Cost — {est.currency}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums text-blue-400">{nf0(grand.labor)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums text-emerald-400">{nf0(grand.mat)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums text-amber-400">{nf0(grand.equip)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums text-violet-400">{nf0(grand.sub)}</td>
                  <td className="border-l border-border px-2 py-2 text-right tabular-nums text-fg">{nf0(direct)}</td>
                  {showProgress && <td className="border-l border-border px-2 py-2 text-right tabular-nums text-green-400">{nf0(grand.prog)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Summary — compact unified "Cost Summary" footer; prints once at the end. */}
      <div className="print-footer">
        <Card className="overflow-hidden p-0">
          {/* Header strip */}
          <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Cost Summary</h3>
            <span className="text-[11px] font-medium text-faint">
              All values in {est.currency}
              {usdSecondary ? ` · $ @ 1 ${est.currency} = ${usdRate.toFixed(4)} USD` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-border">
            {/* Cost by Section */}
            {(() => {
              const sections = [
                { key: "Labor", val: grand.labor, dot: "bg-blue-500", txt: "text-blue-400" },
                { key: "Material", val: grand.mat, dot: "bg-emerald-500", txt: "text-emerald-400" },
                { key: "Equipment", val: grand.equip, dot: "bg-amber-500", txt: "text-amber-400" },
                { key: "Subcontractor", val: grand.sub, dot: "bg-violet-500", txt: "text-violet-400" },
              ];
              const share = (n: number) => (direct > 0 ? (n / direct) * 100 : 0);
              return (
                <div className="px-4 py-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Cost by Section</div>
                  {/* Composition bar */}
                  <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
                    {sections.map((s) => (
                      <div key={s.key} className={s.dot} style={{ width: `${share(s.val)}%` }} title={`${s.key} ${nf0(share(s.val))}%`} />
                    ))}
                  </div>
                  {/* Rows */}
                  <ul className="space-y-1 text-sm">
                    {sections.map((s) => (
                      <li key={s.key} className="flex items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                        <span className="min-w-0 flex-1 truncate text-muted">{s.key}</span>
                        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-faint">{nf0(share(s.val))}%</span>
                        <span className={`shrink-0 whitespace-nowrap tabular-nums font-medium ${s.txt}`}>{dualMoney(s.val)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-sm font-semibold text-fg">
                    <span>Direct cost</span>
                    <span className="whitespace-nowrap tabular-nums">{dualMoney(direct)}</span>
                  </div>
                </div>
              );
            })()}

            {/* Mark-ups & Total */}
            <div className="border-t border-border px-4 py-3 lg:border-t-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Mark-ups &amp; Total</div>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted">Direct cost</span>
                  <span className="whitespace-nowrap tabular-nums text-fg">{dualMoney(direct)}</span>
                </div>
                {/* Optional General Conditions — checkbox to activate; the recap line prints whenever GC is active. */}
                <div className={`flex items-center justify-between gap-2 ${gcActive ? "" : "no-print"}`}>
                  <label className="flex min-w-0 items-center gap-2 text-muted">
                    <input type="checkbox" checked={gcActive} onChange={(e) => setGcActive(e.target.checked)} className="no-print h-3.5 w-3.5 accent-brand" />
                    <span className="truncate">General Conditions / Overhead{gcActive ? ` (${generalConditions.filter((g) => g.enabled).length})` : ""}</span>
                  </label>
                  <span className="whitespace-nowrap tabular-nums text-fg">{gcActive ? dualMoney(gcAmount) : "—"}</span>
                </div>
                <MarkupRow label="Profit & Risk" pct={est.profitPct} amount={profit} money={dualMoney}
                  onPct={(v) => patchMeta({ profitPct: v })} />
                <MarkupRow label="BBO" pct={est.bboPct} amount={bbo} money={dualMoney}
                  onPct={(v) => patchMeta({ bboPct: v })} />
              </dl>

              {/* Grand Total — filled accent on screen, bordered for print fidelity */}
              <div className="mt-3 flex items-center justify-between rounded-lg bg-brand px-3.5 py-2.5 text-brand-fg shadow-sm print:border-2 print:border-fg print:bg-transparent print:text-fg print:shadow-none">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Grand Total</span>
                <span className="text-xl font-bold tabular-nums">{money(grandTotal)}</span>
              </div>

              {/* Optional USD secondary unit on the grand total. */}
              {usdSecondary && (
                <div className="mt-1 flex items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3.5 py-1.5">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand">
                    USD equivalent
                    <span className="no-print inline-flex items-center rounded border border-border bg-surface px-1 text-[10px] normal-case tracking-normal text-faint">
                      1&nbsp;{est.currency}=
                      <input
                        type="number"
                        min={0}
                        step={0.0001}
                        value={usdRate}
                        onChange={(e) => editUsdRate(Number(e.target.value) || 0)}
                        className="w-16 bg-transparent py-0.5 text-center tabular-nums text-fg outline-none focus:bg-brand/10"
                      />
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-base font-bold tabular-nums text-brand">$ {nf0(usdAmt(grandTotal))}</span>
                </div>
              )}

              {showProgress && (
                <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-md border border-border text-xs">
                  <div className="flex flex-col border-r border-border bg-green-500/10 px-3 py-1.5 text-green-400">
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Completed · {nf0(grandPocPct)}%</span>
                    <span className="tabular-nums font-semibold">{money(grand.prog)}</span>
                  </div>
                  <div className="flex flex-col bg-amber-500/10 px-3 py-1.5 text-amber-400">
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Remaining · {nf0(100 - grandPocPct)}%</span>
                    <span className="tabular-nums font-semibold">{money(direct - grand.prog)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick-access charts — always on. The print doc renders its own chart, gated
           * by the "Chart" switch in Print Control, so this one is screen-only to avoid
           * printing the breakdown twice. Both read the same `chartData` segments. */}
          <div className="no-print border-t border-border px-4 py-3 print:hidden">
            <CostSummaryCharts
              segments={chartData}
              sections={computeSections(est).map((s) => ({ name: s.name, cost: s.cost }))}
              money={dualMoney}
            />
          </div>

          {/* Memo / Remark — full-width editable area; printed on the cover page when enabled in Print Control. */}
          <div className="no-print border-t border-border px-4 py-3">
            <label className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-faint">
              <span>Memo / Remark</span>
              <span className="normal-case tracking-normal text-faint">{pc.memo ? "shown on cover page" : "hidden in print — enable “Memo/Remark” in Print Control"}</span>
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              placeholder="A few details about this estimate — assumptions, exclusions, validity, payment terms…"
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-fg outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
            />
          </div>

          {/* Cost per m² — compact unit-rate strip (Grand Total ÷ built-up area). */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border bg-surface-2/30 px-4 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">
              Cost / m²
              {area > 0 ? <span className="ml-1 font-normal normal-case text-faint">÷ {nf0(area)} m²</span> : null}
            </span>
            <span className="hidden h-4 w-px bg-border sm:block" />
            {[
              { k: "Materials", v: grand.mat, txt: "text-emerald-400" },
              { k: "Labor", v: grand.labor, txt: "text-blue-400" },
              { k: "Subcontractor", v: grand.sub, txt: "text-violet-400" },
              { k: "Total", v: grandTotal, txt: "font-bold text-fg" },
            ].map((m) => (
              <span key={m.k} className="inline-flex items-baseline gap-1.5">
                <span className="text-[11px] text-muted">{m.k}</span>
                <span className={`text-xs font-semibold tabular-nums ${m.txt}`}>{m2money(m.v)}</span>
                {usdSecondary && perM2(m.v) !== null ? (
                  <span className="text-[10px] tabular-nums text-brand">(USD {nf2(usdAmt(perM2(m.v) as number))})</span>
                ) : null}
              </span>
            ))}
          </div>

          <p className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-faint">
            Total Hrs = Qty × Norm · Labor Cost = Total Hrs × {est.currency} {nf0(rate)}/hr. Profit &amp; Risk and BBO apply to direct cost + General Conditions / Overhead.
          </p>
        </Card>
      </div>
    </div>
  );

  return (
    <>
      <style>{pageStyle}</style>
      <div className="est-print-guard">
        To print or save this estimate as a PDF, use the <b>Print&nbsp;/&nbsp;PDF</b> button (or
        <b> Preview&nbsp;&amp;&nbsp;Print</b>). That preview is exactly what prints — this editing view is not.
      </div>
      {!preview && pendingDraft ? (
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm">
          <span className="text-amber-900">
            An <b>unsaved backup</b> of this estimate was found from a previous session. Restore it?
          </span>
          <span className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">Restore</button>
            <button type="button" onClick={dismissDraft} className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100">Dismiss</button>
          </span>
        </div>
      ) : null}
      {preview ? (
        <div className="epd-overlay fixed inset-0 z-50 overflow-auto bg-white">
          {/* Print = exactly what's previewed: one rendered doc, un-zoomed and
              flowed (not fixed/clipped) when printing. */}
          <style>{`@media print {
            /* Release the app shell's scroll/height constraints. The overlay flows
               back into <main class="overflow-y-auto"> when made static (below); a
               bounded, scrolling ancestor CLIPS the multi-page document down to a
               single printed page — so neutralize the whole chain here. */
            html, body { height: auto !important; min-height: 0 !important; overflow: visible !important; display: block !important; }
            main { overflow: visible !important; height: auto !important; max-height: none !important; flex: none !important; padding: 0 !important; }
            .epd-overlay { position: static !important; overflow: visible !important; height: auto !important; background: #fff !important; }
            .epd-zoom { zoom: 1 !important; box-shadow: none !important; }
            .epd-dbg-line, .epd-dbg-tag { display: none !important; }
          }`}</style>
          {/* Preview controls */}
          <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold text-fg">Print preview</span>
            <div className="mx-1 h-5 w-px bg-border" />
            <span className="text-xs font-medium text-muted">Paper</span>
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {(["A4", "A3"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPaper(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${paper === p ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="inline-flex overflow-hidden rounded-lg border border-border">
              {(["landscape", "portrait"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrient(o)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${orient === o ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center overflow-hidden rounded-lg border border-border">
              {[0.5, 0.65, 0.8, 1].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setPvZoom(z)}
                  className={`border-l border-border px-2.5 py-1.5 text-xs font-medium transition-colors first:border-l-0 ${Math.abs(pvZoom - z) < 0.001 ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}
                >
                  {Math.round(z * 100)}%
                </button>
              ))}
            </div>
            <div className="mx-1 h-5 w-px bg-border" />
            <span className="text-xs font-medium text-muted">Size</span>
            <select
              value={printSize}
              onChange={(e) => setPrintSize(e.target.value as "normal" | "medium" | "small")}
              title="Print text size — Small fits the most rows per page"
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-fg outline-none focus:border-brand"
            >
              <option value="normal">Normal</option>
              <option value="medium">Medium</option>
              <option value="small">Small</option>
            </select>
            <button
              type="button"
              onClick={() => setPcDebug((v) => !v)}
              title="Show page-break debug overlay (safe boundaries, block heights, continuation markers)"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${pcDebug ? "border-red-400/50 bg-red-50 text-red-600" : "border-border bg-surface text-muted hover:text-fg"}`}
            >
              <Bug className="h-3.5 w-3.5" /> Debug
            </button>
            <span className="text-[11px] text-muted">
              {paper} · {orient} · {pageWmm} × {pageHmm} mm
              {/* Same fact, repeated in the preview toolbar: the Print Control
                * button is not on screen here, and this is exactly where someone
                * is about to commit the sheet to paper. */}
              {" · "}
              <span className={activePrintTemplate ? "font-semibold text-brand" : "text-faint"}>
                {activePrintTemplate || "Custom"}
              </span>
            </span>
            <button type="button" onClick={() => window.print()} className={`ml-auto ${brandBtn}`}>
              <FileDown className="h-4 w-4" /> Save as PDF
            </button>
            <button type="button" onClick={() => window.print()} className={ghostBtn}>
              <Printer className="h-4 w-4" /> Print
            </button>
            {/* Email the PDF straight from the preview. Compose is live; the browser's
                "Save as PDF" produces the file to attach until server-side delivery is wired. */}
            <EmailButton
              variant="ghost"
              label="Email PDF"
              className="h-9 px-3 text-sm"
              subject={`Estimate — ${est.projectName} (${est.version})`}
              attachment={`${est.projectName} — Estimate ${est.version}.pdf`}
              defaultTo={est.client?.includes("@") ? est.client : ""}
              defaultBody={`Dear ${est.client?.trim() || "recipient"},\n\nPlease find attached our cost estimate for ${est.projectName}${est.projectNumber ? ` (No. ${est.projectNumber})` : ""}, version ${est.version}.\n\nKind regards,\n${firmName()}`}
            />
            <button type="button" onClick={() => setPreview(false)} className={ghostBtn}>
              <X className="h-4 w-4" /> Close
            </button>
          </div>

          {/* Smart Page-Break Engine — ONE measurement-first document, used for both the
              on-screen preview (zoomed) and the print (un-zoomed via @media print), so the
              printed PDF always matches the preview exactly. */}
          <div className="flex flex-col items-center p-4 print:p-0">
            <div className="epd-zoom origin-top shadow-sm" style={{ zoom: pvZoom }}>
              <EstimatePrintDoc
                est={est}
                rate={rate}
                textSize={printSize}
                paper={paper}
                orient={orient}
                pc={printControl}
                showProgress={showProgress}
                grandTotalRows={grandTotalRows}
                generalConditions={generalConditions}
                gcActive={gcActive}
                schedule={schedule}
                payment={payment}
                memo={memo}
                logoDataUrl={logoDataUrl}
                logoScale={logoScale}
                footerText={footer?.text}
                footerFontFamily={footer?.fontFamily}
                footerFontSize={footer?.fontSize}
                chartData={chartData}
                importedAmount={importedAmount}
                coverPage={coverOn}
                coverImage={coverImage}
                coverTotalDisplay={dualMoney(grandTotal)}
                usdSecondary={usdSecondary}
                usdRate={usdRate}
                nf0={nf0}
                debug={pcDebug}
                onPages={setEnginePages}
              />
            </div>
            <div className="no-print pb-6 pt-3 text-xs text-faint">
              {enginePages} page{enginePages > 1 ? "s" : ""} · {paper} {orient} · {pageWmm}×{pageHmm} mm
            </div>
          </div>
        </div>
      ) : (
        body
      )}
    </>
  );
}

/**
 * Auto-grow measurement, BATCHED across every field that needs it.
 *
 * Measuring one textarea means writing (`height: auto`) and then reading
 * (`scrollHeight`), and a write followed by a read forces the browser to redo layout
 * synchronously, there and then. For a single field that is free. But every line item
 * on the sheet owns one, and they all measure in the same commit — so the writes and
 * reads interleave and the page is laid out from scratch once PER LINE ITEM. On a
 * 113-line estimate that is 113 full-document reflows back to back, which is roughly
 * half of the multi-second freeze when the print preview closes and the whole grid
 * mounts again.
 *
 * So a field registers instead of measuring. One flush then does every write, every
 * read, and every write again — two reflows for the whole sheet instead of N. It runs
 * as a microtask, which still lands before the browser paints, so no field is ever
 * shown at the wrong height. Behaviour is identical; only the reflow count changes.
 */
const growQueue = new Set<HTMLTextAreaElement>();
let growScheduled = false;

function flushGrow() {
  growScheduled = false;
  const els = [...growQueue].filter((el) => el.isConnected);
  growQueue.clear();
  if (!els.length) return;
  // Writes first — one style invalidation for the batch, no read in between.
  for (const el of els) el.style.height = "auto";
  // Then all reads. The first forces layout once; the rest are already valid.
  const heights = els.map((el) => el.scrollHeight);
  for (let i = 0; i < els.length; i++) els[i].style.height = `${heights[i]}px`;
}

function scheduleGrow(el: HTMLTextAreaElement) {
  growQueue.add(el);
  if (growScheduled) return;
  growScheduled = true;
  queueMicrotask(flushGrow);
}

/**
 * The line-item description field. A single-line <input> physically clipped long
 * descriptions — this is a textarea that WRAPS and auto-grows to fit its content, so the
 * whole task is always visible (and it prints in full). Height is measured off the
 * content on every value change; `rows={1}` keeps a one-line row the same height as the
 * numeric cells until the text actually needs a second line.
 */
function TaskField({
  value,
  onChange,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    scheduleGrow(el);
    // A field unmounted before the flush must not be measured (or resurrected) —
    // drop it from the batch.
    return () => { growQueue.delete(el); };
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      {...rest}
    />
  );
}

const metaInput =
  "min-w-0 flex-1 rounded bg-transparent text-sm font-medium text-fg outline-none focus:bg-brand/5";
const ghostBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2";
const brandBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90";

const ASM_TYPES: { value: AssemblyComponentType; label: string }[] = [
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
  { value: "equipment", label: "Equipment" },
  { value: "subcontract", label: "Subcontract" },
  { value: "other", label: "Other" },
];

/**
 * Assembly-Based component editor — shown in an expandable sub-row under an Assembly
 * line. Each component is priced per assembly unit; the cost distributes into the line's
 * cost columns via `calcAssembly` (see lib/estimates/calc.ts). Edits flow up through
 * `onChange`, which the row wires to `patchItem(..., { assembly })`.
 */
function AssemblyEditor({
  item,
  currency,
  onChange,
}: {
  item: EstimateItem;
  currency: string;
  onChange: (assembly: AssemblyComponent[]) => void;
}) {
  const comps = item.assembly ?? [];
  const units = item.qty || 0;
  const cid = () => `ac-${Math.random().toString(36).slice(2, 9)}`;
  const add = () =>
    onChange([...comps, { id: cid(), name: "", type: "material", qty: 1, unitCost: 0 }]);
  const upd = (id: string, patch: Partial<AssemblyComponent>) =>
    onChange(comps.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const del = (id: string) => onChange(comps.filter((c) => c.id !== id));
  const amount = (c: AssemblyComponent) => units * c.qty * c.unitCost;
  const inp = "w-full rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-fg outline-none focus:border-brand focus:bg-brand/5";

  return (
    <div className="rounded-md border border-brand/30 bg-surface/70 p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Assembly components — priced per unit × {units} unit{units === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={add}
          className="inline-flex h-6 items-center gap-1 rounded border border-brand/40 bg-brand/5 px-2 text-[11px] font-medium text-brand hover:bg-brand/10"
        >
          <Plus className="h-3 w-3" /> Component
        </button>
      </div>
      {comps.length === 0 ? (
        <p className="text-[11px] text-faint">
          No components yet. Add Labor / Material / Equipment / Subcontract / Other lines — each priced per assembly unit.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-faint">
              <th className="pb-1 font-medium">Component</th>
              <th className="pb-1 font-medium">Type</th>
              <th className="pb-1 text-right font-medium">Qty / unit*</th>
              <th className="pb-1 text-right font-medium">Unit cost</th>
              <th className="pb-1 text-right font-medium">Amount</th>
              <th className="pb-1" />
            </tr>
          </thead>
          <tbody>
            {comps.map((c) => (
              <tr key={c.id} className="align-middle">
                <td className="py-0.5 pr-2" style={{ width: "34%" }}>
                  <input value={c.name} placeholder="Description" onChange={(e) => upd(c.id, { name: e.target.value })} className={inp} />
                </td>
                <td className="py-0.5 pr-2" style={{ width: "16%" }}>
                  <select value={c.type} onChange={(e) => upd(c.id, { type: e.target.value as AssemblyComponentType })} className={inp}>
                    {ASM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </td>
                <td className="py-0.5 pr-2">
                  <input type="number" value={c.qty} title={c.type === "labor" ? "Hours per assembly unit" : "Quantity per assembly unit"} onChange={(e) => upd(c.id, { qty: Number(e.target.value) || 0 })} className={`${inp} text-right`} />
                </td>
                <td className="py-0.5 pr-2">
                  <input type="number" value={c.unitCost} title={c.type === "labor" ? "Hourly rate" : "Cost per unit"} onChange={(e) => upd(c.id, { unitCost: Number(e.target.value) || 0 })} className={`${inp} text-right`} />
                </td>
                <td className="py-0.5 pr-2 text-right text-[11px] font-medium tabular-nums text-fg">
                  {currency} {nf0(amount(c))}
                </td>
                <td className="py-0.5 text-center">
                  <button type="button" onClick={() => del(c.id)} aria-label="Remove component" className="inline-flex h-5 w-5 items-center justify-center rounded text-faint hover:text-red-600">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-1.5 text-[10px] leading-snug text-faint">
        *For <b>Labor</b> components, “Qty / unit” = hours per assembly unit and “Unit cost” = hourly rate (these feed the Schedule Coupler). “Other” folds into the Subcontract column.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 whitespace-nowrap text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}

// Labeled toolbar group — keeps related controls visually contained.
function ToolGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-surface-2/60 px-3 py-2 ${className ?? ""}`}>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-faint">{label}</div>
      <div className="flex flex-nowrap items-center gap-2">{children}</div>
    </div>
  );
}

// Compact on/off switch used in the View group.
function Switch({ on, onClick, label, tone }: { on: boolean; onClick: () => void; label: string; tone: "green" | "brand" }) {
  const knob = tone === "green" ? "bg-green-600" : "bg-brand";
  const active = tone === "green" ? "border-green-500/40 bg-green-500/15 text-green-400" : "border-brand/40 bg-brand/10 text-brand";
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onClick} className={`inline-flex h-7 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors ${on ? active : "border-border bg-surface text-muted hover:bg-surface-2"}`}>
      <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${on ? knob : "bg-slate-300"}`}>
        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${on ? "translate-x-3" : "translate-x-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

// Compact toggle row used inside the Print Control popover. Supports a disabled
// (grayed, forced-off) state — used for General Conditions when it isn't active.
function PcRow({ label, on, onToggle, disabled }: { label: string; on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onToggle}
      title={disabled ? "Enable General Conditions / Overhead in the summary below to print it" : undefined}
      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${disabled ? "cursor-not-allowed opacity-40" : "hover:bg-surface-2"}`}
    >
      <span className={disabled ? "text-faint" : "text-fg"}>{label}</span>
      <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${on && !disabled ? "bg-brand" : "bg-slate-300"}`}>
        <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white shadow transition-transform ${on && !disabled ? "translate-x-3" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

function MarkupRow({
  label,
  pct,
  amount,
  money,
  onPct,
}: {
  label: string;
  pct: number;
  amount: number;
  /** Formatter, so the row follows the sheet's USD-secondary setting. */
  money: (n: number) => string;
  onPct: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted">
        {label}
        <span className="inline-flex items-center rounded-md border border-border bg-surface px-1.5">
          <input
            type="number"
            min={0}
            value={pct}
            onChange={(e) => onPct(Number(e.target.value) || 0)}
            className="w-10 bg-transparent py-0.5 text-center text-xs tabular-nums text-fg outline-none focus:bg-brand/5"
          />
          <span className="text-xs text-faint">%</span>
        </span>
      </span>
      <span className="whitespace-nowrap tabular-nums text-fg">{money(amount)}</span>
    </div>
  );
}
