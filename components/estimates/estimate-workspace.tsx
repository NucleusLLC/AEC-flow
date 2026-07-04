"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Ruler, Tags, BookOpen, ListChecks, LayoutGrid, CalendarClock, HardHat, Grid2x2, FileDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CostEstimate, EstimateItem } from "@/lib/data/estimates";
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
import { RebarCalculatorView } from "./rebar-calculator-view";
import { GeneralConditionsView } from "./general-conditions-view";
import { PriceListView } from "./price-list-view";
import { WikiView } from "./wiki-view";

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
  // Budget & Timeline config — lifted here so it survives tab switches and is
  // available to the Estimate print document (Timeline / Phase Disbursement pages).
  const [schedule, setSchedule] = useState<ScheduleConfig>(() => estimate.budget?.schedule ?? defaultSchedule(estimate));
  const [payment, setPayment] = useState<PaymentConfig>(() => estimate.budget?.payment ?? defaultPayment());
  const seq = useRef(100);
  const newId = (p: string) => `${p}-${seq.current++}`;

  // Take-Off → estimate: append a new section of computed, costed line items.
  const pushFromTakeoff = (sectionName: string, items: Omit<EstimateItem, "id">[]) => {
    setEst((e) => ({
      ...e,
      categories: [
        ...e.categories,
        { id: newId("c"), name: sectionName, items: items.map((it) => ({ ...it, id: newId("i") })) },
      ],
    }));
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

      {/* Active panel */}
      {tab === "estimate" ? (
        <EstimateView
          est={est}
          setEst={setEst}
          templates={templates}
          setTemplates={setTemplates}
          activeTemplate={activeTemplate}
          setActiveTemplate={setActiveTemplate}
          normSet={normSet}
          generalConditions={generalConditions}
          materials={prices.materials}
          equipment={prices.equipment}
          schedule={schedule}
          payment={payment}
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
        />
      ) : tab === "takeoff" ? (
        <TakeoffView onPush={pushFromTakeoff} onGoToEstimate={() => setTab("estimate")} normSet={normSet} />
      ) : tab === "rebar" ? (
        <RebarCalculatorView />
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
