"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Ruler, Tags, BookOpen, ListChecks, LayoutGrid, CalendarClock, HardHat, Grid2x2, FileDown, Lock, LockOpen, CopyPlus, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CostEstimate, EstimateItem } from "@/lib/data/estimates";
import { defaultUsdRate, type TakeoffRow } from "@/lib/data/estimates.types";
import type { PriceItem } from "@/lib/data/price-lists.types";
import { type EstimateTemplate, type NormSetTask } from "@/lib/data/estimate-presets";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";
import type { WikiArticle } from "@/lib/data/estimating-wiki";
import {
  defaultSchedule,
  defaultPayment,
  type ScheduleConfig,
  type PaymentConfig,
} from "@/lib/estimates/budget-timeline";
import { EstimateView } from "./estimate-view";
import { BudgetTimelineView } from "./budget-timeline-view";
import { TakeoffView } from "./takeoff-view";
import { NormSetView } from "./normset-view";
import { RebarCalculatorView, type RebarState } from "./rebar-calculator-view";
import { GeneralConditionsView } from "./general-conditions-view";
import { PriceListView } from "./price-list-view";
import { WikiView } from "./wiki-view";
import {
  saveEstimateAction,
  duplicateEstimateAction,
  setEstimateLockAction,
  loadEstimateAction,
} from "@/app/(app)/estimates/actions";

type TabKey = "estimate" | "budget" | "takeoff" | "rebar" | "normset" | "prices" | "general" | "wiki";

const TABS: { key: TabKey; label: string; icon: typeof FileSpreadsheet }[] = [
  { key: "estimate", label: "Estimate", icon: FileSpreadsheet },
  { key: "budget", label: "Budget & Timeline", icon: CalendarClock },
  { key: "takeoff", label: "Take-Off", icon: Ruler },
  { key: "rebar", label: "Rebar Calc", icon: Grid2x2 },
  { key: "normset", label: "Norm Set", icon: ListChecks },
  { key: "prices", label: "Price Lists", icon: Tags },
  { key: "general", label: "General Conditions / Overhead", icon: HardHat },
  { key: "wiki", label: "Wiki", icon: BookOpen },
];

type PriceBook = { materials: PriceItem[]; equipment: PriceItem[] };

/** Sample measurements, shown only on an estimate that has never had a take-off saved. */
const SEED_TAKEOFF: TakeoffRow[] = [
  { id: "to-seed1", desc: "External walls — block", normId: "n-blk200", method: "area", unit: "m²", length: 42, width: 3.2, height: 0, count: 1, waste: 5 },
  { id: "to-seed2", desc: "Ground slab", normId: "n-sog", method: "area", unit: "m²", length: 12, width: 15, height: 0, count: 1, waste: 3 },
  { id: "to-seed3", desc: "Footings concrete", normId: "n-foot", method: "volume", unit: "m³", length: 42, width: 0.6, height: 0.8, count: 1, waste: 5 },
];

export function EstimateWorkspace({ estimate, priceBook, normSet: initialNormSet, generalConditions: initialGC, templates: initialTemplates, wiki, logoDataUrl, footer }: { estimate: CostEstimate; priceBook: PriceBook; normSet: NormSetTask[]; generalConditions: GeneralConditionItem[]; templates: EstimateTemplate[]; wiki: WikiArticle[]; logoDataUrl?: string | null; footer?: import("@/lib/server/practice-config").FooterSettings }) {
  const [tab, setTab] = useState<TabKey>("estimate");
  // Print/PDF is ONE path: the EstimatePrintDoc preview overlay. "Export" opens it
  // so the printed output always equals the preview. (Owned here so it survives
  // tab switches.)
  const [preview, setPreview] = useState(false);
  const [est, setEst] = useState<CostEstimate>(estimate);
  const [prices, setPrices] = useState<PriceBook>(priceBook);
  const [templates, setTemplates] = useState<EstimateTemplate[]>(initialTemplates);
  const [activeTemplate, setActiveTemplate] = useState<string | null>(null);
  const [normSet, setNormSet] = useState<NormSetTask[]>(initialNormSet);
  const [generalConditions, setGeneralConditions] = useState<GeneralConditionItem[]>(initialGC);
  // General Conditions / Overhead active flag — lifted here so the summary (EstimateView),
  // the Budget disbursement tab, and the print doc all agree on whether GC is part of the
  // Total Development Cost that draws are computed against.
  const [gcActive, setGcActive] = useState<boolean>(() => estimate.budget?.gcActive ?? false);
  // Budget & Timeline config — lifted here so it survives tab switches and is
  // available to the Estimate print document (Timeline / Phase Disbursement pages).
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => estimate.budget?.schedule ?? defaultSchedule(estimate));
  const [payment, setPayment] = useState<PaymentConfig>(() => estimate.budget?.payment ?? defaultPayment());
  // Quantity Take-Off — lifted here for the same reason as the budget config: the tabs
  // are a ternary, so leaving the Take-Off tab used to unmount the sheet and destroy
  // every measurement. `?? SEED_TAKEOFF` only fires when the key is absent, so an
  // estimate whose rows were all deliberately deleted stays empty instead of re-seeding.
  const [takeoff, setTakeoff] = useState<TakeoffRow[]>(() => estimate.budget?.takeoff ?? SEED_TAKEOFF);
  const [takeoffSection, setTakeoffSection] = useState<string>(() => estimate.budget?.takeoffSection ?? "Take-Off");
  // USD secondary unit — lifted here (like the take-off rows) so it survives tab switches
  // and rides in the same `budget` payload; the rate used to be local to the sheet and
  // defaulted to 1, so it was both meaningless for a pegged currency and lost on reload.
  const [usdSecondary, setUsdSecondary] = useState<boolean>(() => estimate.budget?.fx?.usd ?? false);
  const [usdRate, setUsdRate] = useState<number>(() => estimate.budget?.fx?.rate ?? defaultUsdRate(estimate.currency));
  // Rebar Calculator inputs — lifted for the same reason as take-off: the tabs are a
  // ternary, so the view unmounts on tab switch and everything it held was lost.
  const [rebar, setRebar] = useState<RebarState | undefined>(() => estimate.budget?.rebar as RebarState | undefined);
  const seq = useRef(100);
  const newId = (p: string) => `${p}-${seq.current++}`;

  /**
   * THE budget payload — one definition, used by every writer.
   *
   * `budget` is a single Json column that each save REPLACES wholesale, so any key a
   * writer forgets is a key that writer deletes. That trap has bitten twice (take-off,
   * then fx). Building it in one place means a new sub-config can't be half-saved: add it
   * here and every path carries it.
   */
  const budget = useMemo(
    () => ({
      schedule,
      payment,
      takeoff,
      takeoffSection,
      fx: { usd: usdSecondary, rate: usdRate },
      gcActive,
      rebar,
    }),
    [schedule, payment, takeoff, takeoffSection, usdSecondary, usdRate, gcActive, rebar],
  );

  // Explicit Save on the Take-Off tab. It writes the WHOLE estimate through the same
  // atomic server action the sheet uses — the take-off rows ride in the `budget` JSON
  // next to schedule/payment, so there's one write path and no second save to keep in
  // sync. (Edits also autosave via EstimateView, which carries the same payload.)
  const [takeoffSaving, setTakeoffSaving] = useState(false);
  const [takeoffSaved, setTakeoffSaved] = useState(false);

  // Re-arm the Save button on any edit. Wrapping the setters (rather than watching the
  // rows in an effect) keeps it a plain event-time update — no cascading render.
  const editTakeoff: React.Dispatch<React.SetStateAction<TakeoffRow[]>> = (v) => {
    setTakeoffSaved(false);
    setTakeoff(v);
  };
  const editTakeoffSection: React.Dispatch<React.SetStateAction<string>> = (v) => {
    setTakeoffSaved(false);
    setTakeoffSection(v);
  };

  const saveTakeoff = async () => {
    if (est.locked) return; // frozen version — the server refuses this write too
    setTakeoffSaving(true);
    const res = await saveEstimateAction({ ...est, budget });
    setTakeoffSaving(false);
    setTakeoffSaved(res.ok);
  };

  /**
   * Workspace autosave — the fix for "the other tabs don't save".
   *
   * The estimate's autosave lives inside EstimateView, and the tabs are a ternary: open
   * Budget & Timeline (or Rebar, or Take-Off) and EstimateView is UNMOUNTED, taking its
   * autosave — and its beforeunload guard — with it. Edits made there reached Postgres
   * only if you happened to click back onto the Estimate tab before leaving. Reload from
   * the Budget tab and the schedule you just built was gone, silently.
   *
   * So: whenever we're NOT on the estimate tab, the workspace runs the debounced save
   * itself. Exactly one autosave is ever armed — EstimateView's when it's mounted, this
   * one otherwise — so the two can't race or clobber each other.
   */
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSaved, setBgSaved] = useState(true);
  useEffect(() => {
    if (tab === "estimate") return; // EstimateView owns the save while it's mounted
    if (!est.id || est.locked) return;
    setBgSaved(false);
    const t = window.setTimeout(async () => {
      setBgSaving(true);
      const res = await saveEstimateAction({ ...est, budget });
      setBgSaving(false);
      setBgSaved(res.ok);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [tab, est, budget]);

  // Take-Off → estimate: append a new section of computed, costed line items.
  const pushFromTakeoff = (sectionName: string, items: Omit<EstimateItem, "id">[]) => {
    setEstGuarded((e) => ({
      ...e,
      categories: [
        ...e.categories,
        { id: newId("c"), name: sectionName, items: items.map((it) => ({ ...it, id: newId("i") })) },
      ],
    }));
  };

  /* ── Versioning & lock ──────────────────────────────────────────────────
   * A locked version is frozen. The server refuses every write to it, so this
   * client-side guard isn't the security boundary — it's what stops the editor
   * from *looking* editable and then failing on save. It wraps setEst ONCE, at
   * the root of the state, so every edit path in every tab is covered by one
   * check rather than each input remembering to ask.
   *
   * The lock toggle itself must bypass the guard (unlocking is a change to a
   * locked estimate, by definition), so it calls the raw setEst. */
  const locked = !!est.locked;
  const setEstGuarded: React.Dispatch<React.SetStateAction<CostEstimate>> = (v) =>
    setEst((prev) =>
      prev.locked ? prev : typeof v === "function" ? (v as (p: CostEstimate) => CostEstimate)(prev) : v,
    );

  const [lockBusy, setLockBusy] = useState(false);
  const toggleLock = async () => {
    if (!est.id) return;
    setLockBusy(true);
    const res = await setEstimateLockAction(est.id, !locked);
    setLockBusy(false);
    if (res.ok) setEst((p) => ({ ...p, locked: !locked }));
    else window.alert(res.error);
  };

  // Version label suggestion: bump the minor (V1.0 → V1.1). Falls back to a suffix when
  // the label isn't numeric, since versions are free text (e.g. "Client A — value eng.").
  const nextVersion = (v: string) => {
    const m = v.match(/^(.*?)(\d+)\.(\d+)\s*$/);
    return m ? `${m[1]}${m[2]}.${Number(m[3]) + 1}` : `${v} (rev)`;
  };

  const [dupOpen, setDupOpen] = useState(false);
  const [dupName, setDupName] = useState("");
  const [dupBusy, setDupBusy] = useState(false);
  const openDuplicate = () => {
    setDupName(nextVersion(est.version));
    setDupOpen(true);
  };
  const doDuplicate = async () => {
    if (!est.id) return;
    setDupBusy(true);
    const res = await duplicateEstimateAction(est.id, dupName);
    setDupBusy(false);
    if (!res.ok) {
      window.alert(res.error);
      return;
    }
    setDupOpen(false);
    // Open the copy: a fresh load, so the new id (not the source's) owns every save.
    const copy = await loadEstimateAction(res.id);
    if (copy) {
      setEst(copy);
      setSchedule(copy.budget?.schedule ?? defaultSchedule(copy));
      setPayment(copy.budget?.payment ?? defaultPayment());
      setTakeoff(copy.budget?.takeoff ?? []);
      setTakeoffSection(copy.budget?.takeoffSection ?? "Take-Off");
      setUsdSecondary(copy.budget?.fx?.usd ?? false);
      setUsdRate(copy.budget?.fx?.rate ?? defaultUsdRate(copy.currency));
      setTab("estimate");
    }
  };

  return (
    <div className="space-y-4">
      {/* Module bar */}
      <Card className="no-print flex flex-wrap items-center gap-2 p-1.5">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${active ? "bg-slate-800 text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2 pr-1">
          <span className="hidden items-center gap-1 text-[11px] uppercase tracking-wide text-faint sm:inline-flex">
            <LayoutGrid className="h-3.5 w-3.5" /> Active template
          </span>
          {activeTemplate ? (
            <Badge tone="green">{activeTemplate}</Badge>
          ) : (
            <Badge tone="slate">none — blank start</Badge>
          )}

          {/* Version — copy to a new version, and freeze the one being superseded. */}
          <div className="relative flex items-center gap-1.5 border-l border-border pl-2">
            <Badge tone={locked ? "amber" : "slate"}>{est.version}</Badge>
            <button
              type="button"
              onClick={toggleLock}
              disabled={!est.id || lockBusy}
              title={locked ? "Unlock — allow edits to this version again" : "Lock this version — no edits, anywhere, until unlocked"}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                locked
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                  : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              {locked ? "Locked" : "Lock"}
            </button>
            <button
              type="button"
              onClick={openDuplicate}
              disabled={!est.id}
              title="Copy this estimate into a new, editable version"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-40"
            >
              <CopyPlus className="h-4 w-4" />
              New Version
            </button>

            {dupOpen ? (
              <div className="absolute right-0 top-10 z-30 w-72 rounded-lg border border-border bg-surface p-3 shadow-xl">
                <div className="mb-1 text-xs font-semibold text-fg">Copy to a new version</div>
                <p className="mb-2 text-[11px] leading-snug text-muted">
                  Copies every section, line item, take-off and budget setting into a new editable
                  estimate. <b>{est.version}</b> is left untouched — lock it to freeze it.
                </p>
                <input
                  autoFocus
                  value={dupName}
                  onChange={(e) => setDupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && dupName.trim() && void doDuplicate()}
                  placeholder="Version name"
                  className="mb-2 w-full rounded-md border border-border bg-surface-2 px-2 py-1.5 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/40"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDupOpen(false)}
                    className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDuplicate()}
                    disabled={!dupName.trim() || dupBusy}
                    className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-fg disabled:opacity-50"
                  >
                    {dupBusy ? "Copying…" : "Create"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Autosave state for the tabs the sheet's own indicator can't reach. */}
          {tab !== "estimate" && est.id && !locked ? (
            <span className="hidden items-center gap-1 text-[11px] text-faint sm:inline-flex" title="Changes on this tab autosave to the server">
              {bgSaving ? "Saving…" : bgSaved ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved
                </>
              ) : (
                "Unsaved…"
              )}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => { setTab("estimate"); setPreview(true); }}
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            title="Open the print preview to print or save as PDF — exactly what prints"
          >
            <FileDown className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </Card>

      {locked ? (
        <div className="no-print flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-500">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            <b>{est.version} is locked.</b> Nothing in this version can be changed — edits are
            refused by the server, not just hidden. Unlock it, or use <b>New Version</b> to work on
            a copy.
          </span>
        </div>
      ) : null}

      {/* Active panel */}
      {tab === "estimate" ? (
        <EstimateView
          est={est}
          setEst={setEstGuarded}
          templates={templates}
          setTemplates={setTemplates}
          activeTemplate={activeTemplate}
          setActiveTemplate={setActiveTemplate}
          normSet={normSet}
          generalConditions={generalConditions}
          gcActive={gcActive}
          setGcActive={setGcActive}
          materials={prices.materials}
          equipment={prices.equipment}
          schedule={schedule}
          payment={payment}
          budget={budget}
          takeoff={takeoff}
          takeoffSection={takeoffSection}
          usdSecondary={usdSecondary}
          setUsdSecondary={setUsdSecondary}
          usdRate={usdRate}
          setUsdRate={setUsdRate}
          logoDataUrl={logoDataUrl}
          footer={footer}
          newId={newId}
          preview={preview}
          setPreview={setPreview}
        />
      ) : tab === "budget" ? (
        <BudgetTimelineView
          est={est}
          schedule={schedule}
          setSchedule={setSchedule}
          payment={payment}
          setPayment={setPayment}
          generalConditions={generalConditions}
          gcActive={gcActive}
        />
      ) : tab === "takeoff" ? (
        <TakeoffView
          onPush={pushFromTakeoff}
          onGoToEstimate={() => setTab("estimate")}
          normSet={normSet}
          rows={takeoff}
          setRows={editTakeoff}
          section={takeoffSection}
          setSection={editTakeoffSection}
          onSave={saveTakeoff}
          saving={takeoffSaving}
          saved={takeoffSaved}
        />
      ) : tab === "rebar" ? (
        <RebarCalculatorView value={rebar} onChange={setRebar} />
      ) : tab === "normset" ? (
        <NormSetView normSet={normSet} setNormSet={setNormSet} />
      ) : tab === "prices" ? (
        <PriceListView
          materials={prices.materials}
          equipment={prices.equipment}
          onSaved={(materials, equipment) => setPrices({ materials, equipment })}
        />
      ) : tab === "general" ? (
        <GeneralConditionsView items={generalConditions} setItems={setGeneralConditions} currency={est.currency} />
      ) : (
        <WikiView initial={wiki} />
      )}
    </div>
  );
}
