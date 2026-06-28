"use client";

import { useRef, useState } from "react";
import { Plus, Trash2, ArrowRightToLine, Ruler } from "lucide-react";
import { Card } from "@/components/ui/card";
import { normTrades, type NormSetTask } from "@/lib/data/estimate-presets";
import { ESTIMATE_UNITS, type EstimateItem } from "@/lib/data/estimates.types";

type Method = "area" | "volume" | "linear" | "count";
type TakeoffRow = {
  id: string;
  desc: string;
  normId: string;
  method: Method;
  unit: string;
  length: number;
  width: number;
  height: number;
  count: number;
  waste: number; // %
};

const METHOD_UNIT: Record<Method, string> = { area: "m²", volume: "m³", linear: "m", count: "no" };
const nf2 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function rawQty(r: TakeoffRow): number {
  const c = r.count || 0;
  if (r.method === "area") return r.length * r.width * c;
  if (r.method === "volume") return r.length * r.width * r.height * c;
  if (r.method === "linear") return r.length * c;
  return c;
}
const netQty = (r: TakeoffRow) => rawQty(r) * (1 + (r.waste || 0) / 100);

const numCls =
  "w-full rounded border border-border bg-surface px-1 py-0.5 text-right text-xs tabular-nums text-fg outline-none focus:ring-1 focus:ring-brand/30";

export function TakeoffView({
  onPush,
  onGoToEstimate,
  normSet,
}: {
  onPush: (sectionName: string, items: Omit<EstimateItem, "id">[]) => void;
  onGoToEstimate: () => void;
  normSet: NormSetTask[];
}) {
  const seq = useRef(1);
  const nid = () => `to-${seq.current++}`;
  const trades = normTrades(normSet);
  const normById = (id: string) => normSet.find((n) => n.id === id);
  const [section, setSection] = useState("Take-Off");
  const [rows, setRows] = useState<TakeoffRow[]>([
    { id: "to-seed1", desc: "External walls — block", normId: "n-blk200", method: "area", unit: "m²", length: 42, width: 3.2, height: 0, count: 1, waste: 5 },
    { id: "to-seed2", desc: "Ground slab", normId: "n-sog", method: "area", unit: "m²", length: 12, width: 15, height: 0, count: 1, waste: 3 },
    { id: "to-seed3", desc: "Footings concrete", normId: "n-foot", method: "volume", unit: "m³", length: 42, width: 0.6, height: 0.8, count: 1, waste: 5 },
  ]);

  const patch = (id: string, p: Partial<TakeoffRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const addRow = () =>
    setRows((rs) => [...rs, { id: nid(), desc: "", normId: "", method: "area", unit: "m²", length: 0, width: 0, height: 0, count: 1, waste: 0 }]);
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));

  // When a Norm Set task is linked, fix the unit and prefill the description.
  const linkNorm = (id: string, normId: string) => {
    const n = normById(normId);
    setRows((rs) =>
      rs.map((r) => {
        if (r.id !== id) return r;
        if (!n) return { ...r, normId: "" };
        const method: Method = n.unit === "m³" ? "volume" : n.unit === "m" || n.unit === "lm" ? "linear" : n.unit === "no" || n.unit === "set" ? "count" : "area";
        return { ...r, normId, unit: n.unit, method, desc: r.desc || n.task };
      }),
    );
  };

  const totalsByUnit = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.unit] = (acc[r.unit] ?? 0) + netQty(r);
    return acc;
  }, {});
  const pushable = rows.filter((r) => netQty(r) > 0 && (r.desc.trim() || r.normId));

  const push = () => {
    const items: Omit<EstimateItem, "id">[] = pushable.map((r) => {
      const n = normById(r.normId);
      return {
        task: r.desc.trim() || n?.task || "Item",
        code: n?.code ?? "",
        qty: Math.round(netQty(r) * 100) / 100,
        unit: r.unit,
        laborNorm: n?.laborNorm ?? 0,
        materialUnitCost: n?.materialUnitCost ?? 0,
        equipmentUnitCost: n?.equipmentUnitCost ?? 0,
        subcontractUnitCost: n?.subcontractUnitCost ?? 0,
        poc: 0,
      };
    });
    if (!items.length) return;
    onPush(section.trim() || "Take-Off", items);
    onGoToEstimate();
  };

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <Ruler className="h-4 w-4 text-brand" /> Quantity Take-Off
        </div>
        <p className="text-xs text-muted">
          Measure elements → quantities compute automatically. Link a Norm Set task to carry its rate & cost, then push straight into the estimate.
        </p>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-faint">Target section</label>
          <input
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="h-8 w-40 rounded-lg border border-border bg-surface px-2 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30"
          />
          <button
            type="button"
            onClick={push}
            disabled={!pushable.length}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowRightToLine className="h-4 w-4" /> Send {pushable.length || ""} to estimate
          </button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Description</th>
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Norm Set (rate)</th>
                <th className="border-b border-border px-2 py-1.5 text-center text-faint">Method</th>
                <th className="border-b border-l border-border px-2 py-1.5 text-right text-faint">Length</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Width</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Height</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">No.</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Waste %</th>
                <th className="border-b border-l border-border bg-green-500/10 px-2 py-1.5 text-right text-green-400">Net Qty</th>
                <th className="border-b border-border bg-green-500/10 px-2 py-1.5 text-center text-green-400">Unit</th>
                <th className="no-print border-b border-border px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const dimDisabled = (m: Method, field: "length" | "width" | "height") => {
                  if (m === "count") return true;
                  if (m === "linear") return field !== "length";
                  if (m === "area") return field === "height";
                  return false; // volume uses all
                };
                return (
                  <tr key={r.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2">
                    <td className="px-2 py-1">
                      <input value={r.desc} onChange={(e) => patch(r.id, { desc: e.target.value })} placeholder="Element" className="w-full min-w-[150px] rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30" />
                    </td>
                    <td className="px-2 py-1">
                      <select value={r.normId} onChange={(e) => linkNorm(r.id, e.target.value)} className="w-full min-w-[150px] rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30">
                        <option value="">— none —</option>
                        {trades.map((trade) => (
                          <optgroup key={trade} label={trade}>
                            {normSet.filter((n) => n.trade === trade).map((n) => (
                              <option key={n.id} value={n.id}>{n.task}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select value={r.method} onChange={(e) => { const m = e.target.value as Method; patch(r.id, { method: m, unit: r.normId ? r.unit : METHOD_UNIT[m] }); }} className="w-full rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30">
                        <option value="area">Area (L×W)</option>
                        <option value="volume">Volume (L×W×H)</option>
                        <option value="linear">Linear (L)</option>
                        <option value="count">Count</option>
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.length} disabled={dimDisabled(r.method, "length")} onChange={(e) => patch(r.id, { length: Number(e.target.value) || 0 })} className={`${numCls} disabled:bg-surface-2 disabled:text-faint`} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.width} disabled={dimDisabled(r.method, "width")} onChange={(e) => patch(r.id, { width: Number(e.target.value) || 0 })} className={`${numCls} disabled:bg-surface-2 disabled:text-faint`} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.height} disabled={dimDisabled(r.method, "height")} onChange={(e) => patch(r.id, { height: Number(e.target.value) || 0 })} className={`${numCls} disabled:bg-surface-2 disabled:text-faint`} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.count} onChange={(e) => patch(r.id, { count: Number(e.target.value) || 0 })} className={numCls} />
                    </td>
                    <td className="px-1 py-1">
                      <input type="number" value={r.waste} onChange={(e) => patch(r.id, { waste: Number(e.target.value) || 0 })} className={numCls} />
                    </td>
                    <td className="border-l border-border bg-green-500/10 px-2 py-1 text-right text-xs font-semibold tabular-nums text-green-400">{nf2(netQty(r))}</td>
                    <td className="bg-green-500/10 px-2 py-1 text-center">
                      <select value={r.unit} onChange={(e) => patch(r.id, { unit: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-green-400 outline-none hover:border-border focus:ring-1 focus:ring-brand/30">
                        {ESTIMATE_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className="no-print px-1 py-1 text-center">
                      <button type="button" onClick={() => removeRow(r.id)} aria-label="Remove" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 border-t border-border p-3">
          <button type="button" onClick={addRow} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2">
            <Plus className="h-3.5 w-3.5" /> Add measurement
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {Object.entries(totalsByUnit).map(([unit, qty]) => (
              <span key={unit} className="inline-flex items-center gap-1 rounded-md border border-border bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                {nf2(qty)} <span className="text-green-400">{unit}</span>
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
