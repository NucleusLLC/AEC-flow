"use client";

import { useRef, useState } from "react";
import { Search, Package, Wrench, RefreshCw, MapPin, Plus, Trash2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  PRICE_REGIONS,
  DEFAULT_REGION,
  REGION_CURRENCY,
  regionOf,
  currencyOf,
  type PriceItem,
} from "@/lib/data/price-lists.types";
import { savePriceBookAction } from "@/app/(app)/estimates/actions";

const editCls =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30";

export function PriceListView({
  materials: initialMaterials,
  equipment: initialEquipment,
  onSaved,
}: {
  materials: PriceItem[];
  equipment: PriceItem[];
  onSaved?: (materials: PriceItem[], equipment: PriceItem[]) => void;
}) {
  const [tab, setTab] = useState<"materials" | "equipment">("materials");
  const [region, setRegion] = useState<string>(DEFAULT_REGION);
  const [q, setQ] = useState("");
  const [materials, setMaterials] = useState<PriceItem[]>(initialMaterials);
  const [equipment, setEquipment] = useState<PriceItem[]>(initialEquipment);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"saved" | string | null>(null);
  const seq = useRef(1);

  async function onSave() {
    setSaving(true);
    setSaveMsg(null);
    const res = await savePriceBookAction(materials, equipment);
    setSaving(false);
    if (res.ok) {
      setSaveMsg("saved");
      onSaved?.(materials, equipment);
    } else {
      setSaveMsg(res.error);
    }
  }

  const list = tab === "materials" ? materials : equipment;
  const setList = tab === "materials" ? setMaterials : setEquipment;

  const term = q.trim().toLowerCase();
  const filtered = list.filter((p) => {
    if (tab === "materials" && regionOf(p) !== region) return false;
    if (!term) return true;
    return p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term) || p.category.toLowerCase().includes(term) || (p.supplier ?? "").toLowerCase().includes(term);
  });

  const patch = (id: string, p: Partial<PriceItem>) => setList((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const remove = (id: string) => setList((a) => a.filter((x) => x.id !== id));
  const addNew = () =>
    setList((a) => [
      {
        id: `px-new-${seq.current++}`,
        code: "",
        name: "",
        category: "Custom",
        unit: tab === "materials" ? "m²" : "day",
        unitPrice: 0,
        region: tab === "materials" ? region : undefined,
        currency: tab === "materials" ? REGION_CURRENCY[region] : undefined,
      },
      ...a,
    ]);

  async function fetchLive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/prices?region=${encodeURIComponent(region)}`, { cache: "no-store" });
      const data: { fetchedAt: string; prices: { id: string; unitPrice: number }[] } = await res.json();
      const next: Record<string, number> = {};
      for (const p of data.prices) next[p.id] = p.unitPrice;
      setMaterials((a) => a.map((p) => (next[p.id] !== undefined ? { ...p, unitPrice: next[p.id] } : p)));
      setFetchedAt(data.fetchedAt);
    } catch {
      setFetchedAt("error");
    } finally {
      setLoading(false);
    }
  }

  const canFetch = region === "Aruba";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-2/50 px-4 py-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-border">
          <button type="button" onClick={() => setTab("materials")} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${tab === "materials" ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}>
            <Package className="h-3.5 w-3.5" /> Materials
          </button>
          <button type="button" onClick={() => setTab("equipment")} className={`inline-flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-xs font-medium transition-colors ${tab === "equipment" ? "bg-brand text-brand-fg" : "bg-surface text-muted hover:text-fg"}`}>
            <Wrench className="h-3.5 w-3.5" /> Equipment
          </button>
        </div>

        {tab === "materials" ? (
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs">
            <MapPin className="h-3.5 w-3.5 text-brand" />
            <span className="text-faint">Location</span>
            <select value={region} onChange={(e) => setRegion(e.target.value)} className="bg-transparent text-xs font-medium text-fg outline-none">
              {PRICE_REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${tab}…`} className="h-8 w-48 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30" />
        </div>

        <button type="button" onClick={addNew} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2">
          <Plus className="h-4 w-4" /> Add New
        </button>

        <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
        {saveMsg === "saved" ? <span className="text-[11px] font-medium text-green-600">Saved ✓</span> : saveMsg ? <span className="text-[11px] text-red-600" title={saveMsg}>Save failed</span> : null}

        {tab === "materials" ? (
          <button type="button" onClick={fetchLive} disabled={!canFetch || loading} title={canFetch ? "Fetch current prices from APEX & Kooyman" : "Live fetch available for Aruba suppliers"} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> {loading ? "Fetching…" : "Fetch live prices (AI)"}
          </button>
        ) : null}
      </div>

      {fetchedAt && tab === "materials" ? (
        <div className="border-b border-border bg-green-500/10 px-4 py-1.5 text-[11px] text-green-400">
          {fetchedAt === "error" ? "Could not reach the price service — showing last known values." : `Live prices updated ${new Date(fetchedAt).toLocaleString()} · sources: APEX, kooymanbv.com (Aruba).`}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-faint">
              <th className="border-b border-border px-2 py-1.5 text-left text-faint">Code</th>
              <th className="border-b border-border px-2 py-1.5 text-left text-faint">Item</th>
              <th className="border-b border-border px-2 py-1.5 text-left text-faint">Category</th>
              <th className="border-b border-border px-2 py-1.5 text-left text-faint">Supplier</th>
              <th className="border-b border-border px-2 py-1.5 text-center text-faint">Unit</th>
              <th className="border-b border-l border-border bg-green-500/15 px-2 py-1.5 text-right text-green-400">Unit Price</th>
              <th className="border-b border-border px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-surface-2">
                <td className="px-2 py-1"><input value={p.code} onChange={(e) => patch(p.id, { code: e.target.value.toUpperCase() })} placeholder="CODE" className={`${editCls} font-mono text-[11px] uppercase text-muted`} /></td>
                <td className="px-2 py-1"><input value={p.name} onChange={(e) => patch(p.id, { name: e.target.value })} placeholder="Item name" className={`${editCls} min-w-[160px]`} /></td>
                <td className="px-2 py-1"><input value={p.category} onChange={(e) => patch(p.id, { category: e.target.value })} placeholder="Category" className={`${editCls} text-[11px] text-muted`} /></td>
                <td className="px-2 py-1"><input value={p.supplier ?? ""} onChange={(e) => patch(p.id, { supplier: e.target.value })} placeholder="—" className={`${editCls} text-[11px] text-faint`} /></td>
                <td className="px-2 py-1 text-center"><input value={p.unit} onChange={(e) => patch(p.id, { unit: e.target.value })} className={`${editCls} w-12 text-center text-[11px]`} /></td>
                <td className="border-l border-green-500/20 bg-green-500/10 px-2 py-1 text-right">
                  <span className="text-[10px] text-green-400">{currencyOf(p)} </span>
                  <input type="number" value={p.unitPrice} onChange={(e) => patch(p.id, { unitPrice: Number(e.target.value) || 0 })} className="w-20 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs font-medium tabular-nums text-green-400 outline-none hover:border-green-500/30 focus:border-green-500/40 focus:ring-1 focus:ring-brand/30" />
                </td>
                <td className="px-1 py-1 text-center">
                  <button type="button" onClick={() => remove(p.id)} aria-label="Remove" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted">No items — use “Add New”.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-faint">
        {tab === "materials" ? `${filtered.length} items · ${region}` : `${filtered.length} items`} · every row is editable; Save persists the price book to the database (and feeds the estimate sheet’s cost picker).
      </p>
    </Card>
  );
}
