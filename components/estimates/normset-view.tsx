"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, ListChecks, Search, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ESTIMATE_UNITS } from "@/lib/data/estimates.types";
import { normTrades, type NormSetTask } from "@/lib/data/estimate-presets";
import { saveNormSetAction } from "@/app/(app)/estimates/actions";

const numCls =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-xs tabular-nums text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30";
const txtCls =
  "w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:border-border focus:ring-1 focus:ring-brand/30";

export function NormSetView({
  normSet,
  setNormSet,
}: {
  normSet: NormSetTask[];
  setNormSet: React.Dispatch<React.SetStateAction<NormSetTask[]>>;
}) {
  const seq = useRef(1);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<"saved" | string | null>(null);
  const trades = normTrades(normSet);

  async function onSave() {
    setSaving(true);
    setSaveMsg(null);
    const res = await saveNormSetAction(normSet);
    setSaving(false);
    setSaveMsg(res.ok ? "saved" : res.error);
  }

  const patch = (id: string, p: Partial<NormSetTask>) =>
    setNormSet((s) => s.map((n) => (n.id === id ? { ...n, ...p } : n)));
  const remove = (id: string) => setNormSet((s) => s.filter((n) => n.id !== id));
  const add = (trade: string) =>
    setNormSet((s) => [
      ...s,
      { id: `ns-new-${seq.current++}`, trade: trade || "General", task: "", unit: "m²", laborNorm: 0, code: "" },
    ]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return normSet;
    return normSet.filter(
      (n) => n.task.toLowerCase().includes(term) || n.trade.toLowerCase().includes(term) || (n.code ?? "").toLowerCase().includes(term),
    );
  }, [normSet, q]);

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-3 px-4 py-3">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
          <ListChecks className="h-4 w-4 text-brand" /> Norm Set List
        </div>
        <p className="text-xs text-muted">
          Standard tasks with fixed Norm Hrs/Unit & costs. Edit freely — changes feed the “＋ Norm Set” picker, the Take-Off and the sheet.
        </p>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 w-56 rounded-lg border border-border bg-surface pl-8 pr-3 text-xs text-fg outline-none focus:ring-1 focus:ring-brand/30"
          />
        </div>
        <button type="button" onClick={() => add("General")} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-fg hover:bg-surface-2">
          <Plus className="h-4 w-4" /> Add task
        </button>
        <button type="button" onClick={onSave} disabled={saving} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
          <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
        </button>
        {saveMsg === "saved" ? <span className="text-[11px] font-medium text-green-600">Saved ✓</span> : saveMsg ? <span className="text-[11px] text-red-600" title={saveMsg}>Save failed</span> : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-faint">
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Trade</th>
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Code</th>
                <th className="border-b border-border px-2 py-1.5 text-left text-faint">Task</th>
                <th className="border-b border-border px-2 py-1.5 text-center text-faint">Unit</th>
                <th className="border-b border-l border-border px-2 py-1.5 text-right text-faint">Norm hr/u</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Material</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Equipment</th>
                <th className="border-b border-border px-2 py-1.5 text-right text-faint">Subcontract</th>
                <th className="border-b border-border px-1 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((n) => (
                <tr key={n.id} className="border-b border-border/70 odd:bg-surface even:bg-surface-2 hover:bg-surface-2">
                  <td className="px-2 py-1">
                    <input value={n.trade} onChange={(e) => patch(n.id, { trade: e.target.value })} list="norm-trades" className={`${txtCls} min-w-[110px] text-muted`} />
                  </td>
                  <td className="px-2 py-1">
                    <input value={n.code ?? ""} onChange={(e) => patch(n.id, { code: e.target.value.toUpperCase() })} className={`${txtCls} min-w-[80px] font-mono text-[11px] uppercase text-muted`} placeholder="CODE" />
                  </td>
                  <td className="px-2 py-1">
                    <input value={n.task} onChange={(e) => patch(n.id, { task: e.target.value })} className={`${txtCls} min-w-[200px]`} placeholder="Task description" />
                  </td>
                  <td className="px-2 py-1 text-center">
                    <select value={n.unit} onChange={(e) => patch(n.id, { unit: e.target.value })} className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-fg outline-none hover:border-border focus:ring-1 focus:ring-brand/30">
                      {ESTIMATE_UNITS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </td>
                  <td className="border-l border-border bg-blue-500/10 px-1 py-1">
                    <input type="number" step={0.05} value={n.laborNorm} onChange={(e) => patch(n.id, { laborNorm: Number(e.target.value) || 0 })} className={numCls} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={n.materialUnitCost ?? 0} onChange={(e) => patch(n.id, { materialUnitCost: Number(e.target.value) || 0 })} className={numCls} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={n.equipmentUnitCost ?? 0} onChange={(e) => patch(n.id, { equipmentUnitCost: Number(e.target.value) || 0 })} className={numCls} />
                  </td>
                  <td className="px-1 py-1">
                    <input type="number" value={n.subcontractUnitCost ?? 0} onChange={(e) => patch(n.id, { subcontractUnitCost: Number(e.target.value) || 0 })} className={numCls} />
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button type="button" onClick={() => remove(n.id)} aria-label="Remove task" className="inline-flex h-6 w-6 items-center justify-center rounded text-faint hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">No tasks match “{q}”.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <datalist id="norm-trades">
          {trades.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <p className="border-t border-border px-4 py-2 text-[11px] text-faint">
          {normSet.length} tasks · Save persists the Norm Set to the database (it feeds the “＋ Norm Set” picker, Take-Off and the sheet).
        </p>
      </Card>
    </div>
  );
}
