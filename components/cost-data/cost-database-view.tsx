"use client";

import { useMemo, useState } from "react";
import {
  Database, Boxes, TrendingUp, Globe2, Upload, ShieldCheck, LayoutGrid, Search, Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PROVIDERS, ACTIVE_PROVIDERS, DEFERRED_PROVIDERS, MVP_FREE_ONLY } from "@/lib/data/cost-data/providers";
import {
  COST_SOURCES, COST_ITEMS, COST_INDEXES, REGIONAL_ADJUSTMENTS, REGION_TARGETS,
} from "@/lib/data/cost-data/seed";
import { indexedCost, factorsFor, adjustedCost } from "@/lib/data/cost-data/engines";
import { disclaimerFor } from "@/lib/data/cost-data/compliance";
import type { CostItem } from "@/lib/data/cost-data/types";

type Tab = "dashboard" | "providers" | "items" | "index" | "regional" | "import" | "compliance";
const TABS: { key: Tab; label: string; icon: typeof Database }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "providers", label: "Providers", icon: Database },
  { key: "items", label: "Cost Items", icon: Boxes },
  { key: "index", label: "Indexation", icon: TrendingUp },
  { key: "regional", label: "Regional", icon: Globe2 },
  { key: "import", label: "Import", icon: Upload },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
];

const num = (n: number) => Math.round(n).toLocaleString("en-US");
const money = (n: number, cur: string) => `${cur} ${num(n)}`;

export function CostDatabaseView() {
  const [tab, setTab] = useState<Tab>("dashboard");
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-1.5">
        <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-border">
          {TABS.map((t, i) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${active ? "bg-slate-800 text-white" : "bg-surface text-muted hover:bg-surface-2 hover:text-fg"}`}>
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>
        <Badge tone="green" className="ml-auto">MVP · free sources only</Badge>
      </Card>

      {tab === "dashboard" ? <Dashboard /> : null}
      {tab === "providers" ? <Providers /> : null}
      {tab === "items" ? <Items /> : null}
      {tab === "index" ? <Indexation /> : null}
      {tab === "regional" ? <Regional /> : null}
      {tab === "import" ? <ImportPanel /> : null}
      {tab === "compliance" ? <Compliance /> : null}
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
function Dashboard() {
  const freeSources = COST_SOURCES.filter((s) => !s.licenseRequired);
  const licensedSources = COST_SOURCES.filter((s) => s.licenseRequired);
  const stats = [
    { label: "Active sources", value: freeSources.length, sub: `free · ${licensedSources.length} licensed deferred` },
    { label: "Cost items", value: COST_ITEMS.length, sub: "NL · Aruba · CO · USA" },
    { label: "Indices", value: COST_INDEXES.filter((i) => i.sourceId === "src-cbs").length, sub: "CBS public" },
    { label: "Regional targets", value: REGION_TARGETS.length, sub: "adjustment sets" },
  ];
  const estimateTypes = ["Quick m²", "m³", "Elemental", "Detailed BOQ", "Replacement Cost New", "Insurance replacement", "Appraisal cost approach", "Developer feasibility"];
  const phases = [
    "Phase 1 — Manual + Excel/CSV import",
    "Phase 2 — Public CBS / Data Overheid index connector",
    "Phase 3 — Licensed provider import templates",
    "Phase 4 — Direct API connectors (if granted)",
    "Phase 5 — White-label / reseller integration",
  ];
  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50/50 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="text-xs text-emerald-900">
          <span className="font-semibold">Running on free sources only.</span> CBS / Data Overheid public index + ZenArch internal & manual pricing — no licence fees. Licensed Dutch databases (BouwkostenKompas, BDB, Archidat) are deferred and can be switched on later via <span className="font-mono">MVP_FREE_ONLY</span> in <span className="font-mono">providers.ts</span>.
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-faint">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold text-fg">{s.value}</div>
            <div className="text-xs text-muted">{s.sub}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-fg">Integration roadmap</h3>
          <ol className="mt-3 space-y-2">
            {phases.map((p, i) => (
              <li key={p} className="flex items-center gap-2 text-xs text-muted">
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${i < 2 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{i + 1}</span>
                {p}
              </li>
            ))}
          </ol>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-fg">Estimate types supported</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {estimateTypes.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs text-fg">
                <Building2 className="h-3 w-3 text-brand" /> {e}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Providers ---------------- */
function Providers() {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Active in MVP · free</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ACTIVE_PROVIDERS.map((p) => <ProviderCard key={p.id} p={p} />)}
        </div>
      </div>
      {MVP_FREE_ONLY && DEFERRED_PROVIDERS.length ? (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">Deferred · licensed (not in MVP)</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {DEFERRED_PROVIDERS.map((p) => <ProviderCard key={p.id} p={p} deferred />)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProviderCard({ p, deferred }: { p: (typeof PROVIDERS)[number]; deferred?: boolean }) {
  return (
    <Card className={`p-4 ${deferred ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-fg">{p.providerName}</div>
          <div className="mt-0.5 text-xs text-muted">{p.description}</div>
        </div>
        {deferred ? <Badge tone="slate">deferred</Badge> : p.licenseRequired ? <Badge tone="amber">licensed</Badge> : <Badge tone="green">free</Badge>}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span><span className="text-faint">Type</span> {p.providerType}</span>
        <span><span className="text-faint">Country</span> {p.country}</span>
        <span><span className="text-faint">Currency</span> {p.currency}</span>
        <span><span className="text-faint">Updates</span> {p.updateFrequency}</span>
        <span><span className="text-faint">Confidence</span> {p.confidenceLevel}</span>
        <span><span className="text-faint">Last sync</span> {p.lastSyncDate ?? "—"}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="slate">Phase {p.integrationPhase}</Badge>
        {p.capabilities.map((c) => (
          <span key={c} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">{c}</span>
        ))}
      </div>
      <Licensing p={p} />
    </Card>
  );
}

/* Licensing cost guidance — figures are UNVERIFIED estimates; see providers.ts to adjust/delete. */
function Licensing({ p }: { p: (typeof PROVIDERS)[number] }) {
  const L = p.licensing;
  const cyc = L.billing === "annual" ? "/yr" : L.billing === "monthly" ? "/mo" : L.billing === "one_time" ? " one-time" : "";
  const amount = L.estAmountMin != null ? `est. ${L.currency} ${L.estAmountMin.toLocaleString()}–${(L.estAmountMax ?? L.estAmountMin).toLocaleString()}${cyc}` : "";
  const free = L.model === "free";
  return (
    <div className={`mt-2 rounded-lg border px-3 py-1.5 text-[11px] ${free ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{free ? "Free — no licence fee" : `${L.model}, ${L.billing} · ${amount}`}</span>
        <span className="flex items-center gap-1">
          {!L.verified ? <span className="rounded bg-amber-200 px-1 text-[10px] font-semibold uppercase text-amber-900">unverified · get quote</span> : null}
          <RecBadge rec={L.recommendation} />
        </span>
      </div>
      <div className="mt-0.5 text-faint">{L.note}</div>
    </div>
  );
}
function RecBadge({ rec }: { rec: "keep" | "evaluate" | "eliminate" }) {
  const tone = rec === "keep" ? "green" : rec === "evaluate" ? "amber" : "red";
  return <Badge tone={tone as "green" | "amber" | "red"}>{rec}</Badge>;
}

/* ---------------- Cost Items browser ---------------- */
function Items() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("All");
  const regions = ["All", ...COST_ITEMS.reduce<string[]>((a, i) => (i.region && !a.includes(i.region) ? [...a, i.region] : a), [])];
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    return COST_ITEMS.filter((i) => {
      if (region !== "All" && i.region !== region) return false;
      if (!t) return true;
      return i.title.toLowerCase().includes(t) || (i.classificationCode ?? "").toLowerCase().includes(t) || (i.externalReferenceCode ?? "").toLowerCase().includes(t);
    });
  }, [q, region]);
  const srcName = (id: string) => COST_SOURCES.find((s) => s.id === id)?.name ?? id;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
          <span className="text-faint">Region</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-transparent text-xs font-medium text-fg outline-none">
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items / codes…" className="h-8 w-60 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-200">
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Ref / Classification</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Title</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-left text-slate-100">Source · Region</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-slate-100">Unit</th>
              <th className="border-b border-slate-700 bg-slate-800 px-3 py-1.5 text-center text-slate-100">Quality</th>
              <th className="border-b border-l border-slate-600 bg-green-700 px-3 py-1.5 text-right text-white">Base Cost</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it: CostItem) => (
              <tr key={it.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-brand/5">
                <td className="px-3 py-1.5 text-[11px]">
                  <span className="font-mono text-muted">{it.externalReferenceCode}</span>
                  {it.classificationCode ? <span className="ml-1 text-faint">· {it.classificationSystem} {it.classificationCode}</span> : null}
                </td>
                <td className="px-3 py-1.5 text-xs text-fg">{it.title}</td>
                <td className="px-3 py-1.5 text-[11px] text-muted">{srcName(it.sourceId)} · {it.region}</td>
                <td className="px-3 py-1.5 text-center text-[11px] text-muted">{it.unit}</td>
                <td className="px-3 py-1.5 text-center text-[11px] text-muted">{it.qualityLevel}</td>
                <td className="border-l border-green-200 bg-green-50/40 px-3 py-1.5 text-right text-xs font-medium tabular-nums text-green-800">{money(it.baseCost, it.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-[11px] text-faint">{items.length} items · classification: STABU / NL-SfB / IFC / ZenArch (codes & titles only — no copyrighted standards text stored).</p>
    </Card>
  );
}

/* ---------------- Indexation calculator ---------------- */
function Indexation() {
  const [base, setBase] = useState(168);
  const [baseIdx, setBaseIdx] = useState(100);
  const [curIdx, setCurIdx] = useState(137.4);
  const result = indexedCost(base, baseIdx, curIdx);
  // MVP: only free (non-licensed) indices are available — hides the licensed BDB feed.
  const indices = COST_INDEXES.filter((ix) => !MVP_FREE_ONLY || !COST_SOURCES.find((s) => s.id === ix.sourceId)?.licenseRequired);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Indexation calculator</h3>
        <p className="mt-1 text-xs text-muted">Indexed Cost = Base Cost × (Current Index ÷ Base Index)</p>
        <div className="mt-4 space-y-3">
          <Field label="Base cost"><input type="number" value={base} onChange={(e) => setBase(Number(e.target.value) || 0)} className={inp} /></Field>
          <Field label="Base index"><input type="number" value={baseIdx} onChange={(e) => setBaseIdx(Number(e.target.value) || 0)} className={inp} /></Field>
          <Field label="Current index"><input type="number" value={curIdx} onChange={(e) => setCurIdx(Number(e.target.value) || 0)} className={inp} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg border border-green-600/30 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          <span>Indexed cost</span><span className="tabular-nums">{num(result)}</span>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Available indices</h3>
        <div className="mt-3 space-y-2">
          {indices.map((ix) => (
            <button key={ix.id} type="button" onClick={() => setCurIdx(ix.indexValue)} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-xs hover:bg-surface-2">
              <span><span className="font-medium text-fg">{ix.indexName}</span><span className="text-faint"> · base {ix.baseYear} · {ix.indexDate.slice(0, 7)}</span></span>
              <span className="tabular-nums font-semibold text-fg">{ix.indexValue}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-faint">Click an index to load it as the current index. CBS public data (free). Licensed BDB index is deferred.</p>
      </Card>
    </div>
  );
}

/* ---------------- Regional adjustment ---------------- */
function Regional() {
  const [targetKey, setTargetKey] = useState(`${REGION_TARGETS[0].country}|${REGION_TARGETS[0].region}`);
  const [cost, setCost] = useState(168);
  const [country, regionName] = targetKey.split("|");
  const f = factorsFor(REGIONAL_ADJUSTMENTS, country, regionName);
  const result = adjustedCost(cost, f);
  const rows = REGIONAL_ADJUSTMENTS.filter((a) => a.country === country && a.region === regionName);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Regional adjustment</h3>
        <p className="mt-1 text-xs text-muted">Adjusted = Indexed × Regional × Logistics × Currency</p>
        <div className="mt-4 space-y-3">
          <Field label="Target region">
            <select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} className={inp}>
              {REGION_TARGETS.map((t) => <option key={`${t.country}|${t.region}`} value={`${t.country}|${t.region}`}>{t.country} — {t.region}</option>)}
            </select>
          </Field>
          <Field label="Indexed cost (source)"><input type="number" value={cost} onChange={(e) => setCost(Number(e.target.value) || 0)} className={inp} /></Field>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <Factor label="Regional" v={f.regionalFactor} />
          <Factor label="Logistics" v={f.logisticsFactor} />
          <Factor label="Currency" v={f.currencyConversion} />
        </div>
        <div className="mt-3 flex items-center justify-between rounded-lg border border-green-600/30 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
          <span>Adjusted cost</span><span className="tabular-nums">{num(result)}</span>
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Adjustment factors — {country} / {regionName}</h3>
        <table className="mt-3 w-full text-xs">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-1.5 capitalize text-muted">{r.adjustmentType.replace("_", " ")}</td>
                <td className="py-1.5 text-faint">{r.notes ?? ""}</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-fg">×{r.adjustmentFactor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ---------------- Import (Phase 1 stub w/ column mapper) ---------------- */
const TARGET_FIELDS = ["title", "external_reference_code", "classification_code", "unit", "base_cost", "currency", "cost_type", "region", "quality_level"];
function ImportPanel() {
  const [format, setFormat] = useState<"csv" | "excel" | "json" | "api">("csv");
  const [header, setHeader] = useState("");
  const cols = header.split(/[;,\t]/).map((c) => c.trim()).filter(Boolean);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Import licensed cost data</h3>
        <p className="mt-1 text-xs text-muted">Phase 1 supports manual + spreadsheet import. Licensed data is imported by authorised users only — never scraped or bundled.</p>
        <div className="mt-3 inline-flex overflow-hidden rounded-lg border border-border">
          {(["csv", "excel", "json", "api"] as const).map((fm) => (
            <button key={fm} type="button" onClick={() => setFormat(fm)} className={`px-3 py-1.5 text-xs font-medium uppercase transition-colors ${format === fm ? "bg-slate-800 text-white" : "bg-surface text-muted hover:text-fg"}`}>{fm}</button>
          ))}
        </div>
        {format === "api" ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">API connectors are Phase 4 — enabled only if a provider grants API access. Use CSV/Excel import in the meantime.</p>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Paste the {format.toUpperCase()} header row</div>
              <input value={header} onChange={(e) => setHeader(e.target.value)} placeholder="e.g. Code, Omschrijving, Eenheid, Prijs, Valuta" className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
            </div>
            {cols.length ? (
              <div className="rounded-lg border border-border">
                <div className="border-b border-border bg-surface-2/50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-faint">Map columns → cost_items</div>
                {cols.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-border/60 px-3 py-1.5 last:border-b-0">
                    <span className="w-48 truncate text-xs text-fg">{c}</span>
                    <span className="text-faint">→</span>
                    <select className="rounded border border-border bg-surface px-2 py-1 text-xs text-fg outline-none">
                      <option value="">— ignore —</option>
                      {TARGET_FIELDS.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                ))}
                <div className="px-3 py-2"><button type="button" className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg opacity-60" disabled title="Parsing lands in Phase 1 build-out">Import mapped rows (stub)</button></div>
              </div>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- Compliance ---------------- */
function Compliance() {
  const rules = [
    "Do not expose raw licensed database content to unauthorised users.",
    "Limit access by company / licence; track who imported the data and the original source.",
    "Log usage; allow deletion of licensed data when a licence expires.",
    "Do not train AI models on third-party licensed cost data unless explicitly permitted.",
    "Store only classification codes, titles and links — never copyrighted standards text.",
  ];
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-fg"><ShieldCheck className="h-4 w-4 text-brand" /> Licensing guardrails</h3>
        <ul className="mt-3 space-y-2">
          {rules.map((r) => (
            <li key={r} className="flex items-start gap-2 text-xs text-muted"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{r}</li>
          ))}
        </ul>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Source licence status</h3>
        <div className="mt-3 space-y-1.5">
          {COST_SOURCES.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-xs">
              <span className="text-fg">{s.name}</span>
              {!s.licenseRequired ? (
                <Badge tone="green">free — active</Badge>
              ) : MVP_FREE_ONLY ? (
                <Badge tone="slate">deferred — not in MVP</Badge>
              ) : (
                <Badge tone={s.active ? "green" : "amber"}>{s.active ? "licensed — active" : "licence required"}</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-fg">Report disclaimer preview</h3>
        <p className="mt-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-[11px] leading-relaxed text-muted">
          {disclaimerFor(MVP_FREE_ONLY ? COST_SOURCES.filter((s) => !s.licenseRequired) : COST_SOURCES)}
        </p>
      </Card>
    </div>
  );
}

/* ---------------- small helpers ---------------- */
const inp = "w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}
function Factor({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 py-2">
      <div className="text-[10px] uppercase tracking-wide text-faint">{label}</div>
      <div className="text-sm font-semibold tabular-nums text-fg">×{v.toFixed(3)}</div>
    </div>
  );
}
